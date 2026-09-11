import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, LocateFixed, LogOut, MapPin, Pencil, Search, Sparkles, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import type { MapProfile } from "@/components/FreelancerMap";
import { ProfileEditor } from "@/components/ProfileEditor";

const FreelancerMap = lazy(() => import("@/components/FreelancerMap").then((module) => ({ default: module.FreelancerMap })));

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Atlaswork | Freelancers Around the World" },
    { name: "description", content: "Explore a live map of independent professionals, their services, skills, availability, and pricing." },
    { property: "og:title", content: "Atlaswork | Freelancers Around the World" },
    { property: "og:description", content: "Explore a live map of independent professionals and their services." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  const [profiles, setProfiles] = useState<MapProfile[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [myProfile, setMyProfile] = useState<MapProfile | null>(null);
  const [selected, setSelected] = useState<MapProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("All");

  const loadProfiles = useCallback(async () => {
    const [{ data: listed, error }, { data: auth }] = await Promise.all([
      supabase.from("profiles").select("id,username,full_name,headline,avatar_url,latitude,longitude,location_name,tags,services,starting_price,currency,is_available").eq("is_listed", true),
      supabase.auth.getUser(),
    ]);
    if (error) toast.error("Could not load the freelancer map.");
    setProfiles((listed ?? []) as MapProfile[]);
    setMe(auth.user);
    if (auth.user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
      setMyProfile(data as MapProfile | null);
    } else setMyProfile(null);
  }, []);

  useEffect(() => {
    void loadProfiles();
    const channel = supabase.channel("live-freelancers").on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void loadProfiles()).subscribe();
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void loadProfiles(); });
    return () => { void supabase.removeChannel(channel); data.subscription.unsubscribe(); };
  }, [loadProfiles]);

  const tags = useMemo(() => ["All", ...Array.from(new Set(profiles.flatMap((profile) => profile.tags))).slice(0, 5)], [profiles]);
  const visible = useMemo(() => profiles.filter((profile) => {
    const haystack = [profile.full_name, profile.username, profile.headline, profile.location_name, ...profile.tags, ...profile.services].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase()) && (activeTag === "All" || profile.tags.includes(activeTag));
  }), [activeTag, profiles, query]);

  async function signIn() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin, extraParams: { prompt: "select_account" } });
    if (result.error) toast.error(result.error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setEditing(false); setSelected(null); setMe(null); setMyProfile(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">A</span>Atlaswork</div>
        <div className="search-wrap"><Search size={17} /><Input aria-label="Search freelancers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills, services or places" /></div>
        <div className="topbar-actions">
          {me && myProfile ? <><Button variant="map" onClick={() => setEditing(true)}><Pencil />My profile</Button><Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sign out"><LogOut /></Button></> : <Button variant="map" onClick={() => void signIn()}><Sparkles />Join the map</Button>}
        </div>
      </header>
      <div className="map-layout">
        <section className="directory" aria-label="Freelancer directory">
          <div className="directory-heading"><span className="eyebrow">Independent, everywhere</span><h1>Talent has no borders.</h1><p className="directory-count">{visible.length} {visible.length === 1 ? "freelancer" : "freelancers"} on the map</p></div>
          <div className="filter-row">{tags.map((tag) => <button type="button" className="filter-chip" data-active={activeTag === tag} key={tag} onClick={() => setActiveTag(tag)}>{tag}</button>)}</div>
          <div className="profile-list">
            {visible.map((profile) => <button type="button" className="profile-item" data-active={selected?.id === profile.id} key={profile.id} onClick={() => setSelected(profile)}>
              {profile.avatar_url ? <img className="profile-avatar" src={profile.avatar_url} alt="" /> : <span className="profile-avatar">{(profile.full_name || profile.username).slice(0, 1).toUpperCase()}</span>}
              <span className="profile-copy"><strong>{profile.full_name || `@${profile.username}`}</strong><span>{profile.headline || profile.services[0] || "Independent freelancer"}</span><span>{profile.location_name || "Location pinned"}</span></span>
              {profile.is_available && <span className="available-dot" title="Available for work" />}
            </button>)}
            {!visible.length && <div className="p-8 text-center text-sm text-muted-foreground">No matching people yet.</div>}
          </div>
        </section>
        <section className="map-stage" aria-label="World map of freelancers">
          {!profiles.length && <div className="map-empty">Be the first freelancer to appear here.</div>}
          {picking && <div className="map-help"><LocateFixed size={16} /> Click your exact location on the map</div>}
          <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}><FreelancerMap profiles={visible} selectedId={selected?.id ?? null} onSelect={setSelected} pickLocation={picking ? (lat, lng) => { setPickedLocation({ lat, lng }); setPicking(false); } : undefined} /></Suspense>
          {selected && <aside className="detail-panel">
            <div className="detail-cover"><Button className="detail-close" variant="secondary" size="icon" onClick={() => setSelected(null)} aria-label="Close details"><X /></Button>{selected.avatar_url && <img className="detail-avatar" src={selected.avatar_url} alt={`${selected.full_name} profile`} />}</div>
            <div className="detail-body"><span className="eyebrow">{selected.is_available ? "Available for work" : "Currently booked"}</span><h2>{selected.full_name || `@${selected.username}`}</h2><p>{selected.headline}</p><div className="detail-meta"><span><MapPin size={14} />{selected.location_name || "Pinned location"}</span>{selected.starting_price != null && <span><BriefcaseBusiness size={14} />From {selected.currency} {selected.starting_price}</span>}</div><div className="tag-list">{[...selected.services, ...selected.tags].map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><h3>About</h3><p>{(selected as MapProfile & { bio?: string }).bio || "This freelancer is ready to collaborate. Sign in and create your own profile to join the community."}</p></div>
          </aside>}
          {editing && myProfile && <ProfileEditor profile={myProfile} onClose={() => { setEditing(false); setPicking(false); }} onSaved={() => { setEditing(false); void loadProfiles(); }} onPickingChange={setPicking} pickedLocation={pickedLocation} />}
        </section>
      </div>
    </main>
  );
}
