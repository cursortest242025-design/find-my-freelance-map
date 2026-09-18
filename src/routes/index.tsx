import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe2, LocateFixed, LogOut, Pencil, Search, Sparkles } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import type { MapProfile, ViewTarget } from "@/components/FreelancerMap";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ProfileDetails } from "@/components/ProfileDetails";
import { FavoritesSidebar } from "@/components/FavoritesSidebar";

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
  const [country, setCountry] = useState("all");
  const [viewTarget, setViewTarget] = useState<ViewTarget | undefined>(undefined);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const promptedSetup = useRef(false);
  const homeSet = useRef(false);

  const loadFavorites = useCallback(async (userId: string | null) => {
    if (!userId) { setFavoriteIds([]); return; }
    const { data } = await supabase.from("favorites").select("profile_id").eq("user_id", userId);
    setFavoriteIds((data ?? []).map((row) => row.profile_id));
  }, []);

  const loadProfiles = useCallback(async () => {
    const [{ data: listed, error }, { data: auth }] = await Promise.all([
      supabase.from("profiles").select("*").eq("is_listed", true),
      supabase.auth.getUser(),
    ]);
    if (error) toast.error("Could not load the freelancer map.");
    setProfiles((listed ?? []) as MapProfile[]);
    setMe(auth.user);
    void loadFavorites(auth.user?.id ?? null);
    if (auth.user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
      const mine = data as MapProfile | null;
      setMyProfile(mine);
      // Right after signing up, take the freelancer straight to their profile setup.
      if (mine && !mine.is_listed && !promptedSetup.current) {
        promptedSetup.current = true;
        setEditing(true);
      }
    } else {
      setMyProfile(null);
      promptedSetup.current = false;
    }
  }, [loadFavorites]);

  useEffect(() => {
    void loadProfiles();
    const channel = supabase.channel("live-freelancers").on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void loadProfiles()).subscribe();
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void loadProfiles(); });
    return () => { void supabase.removeChannel(channel); data.subscription.unsubscribe(); };
  }, [loadProfiles]);

  // Open the map where the visitor actually is, e.g. Bangalore for someone in India.
  useEffect(() => {
    if (homeSet.current) return;
    homeSet.current = true;
    void (async () => {
      try {
        const response = await fetch("https://ipapi.co/json/");
        if (!response.ok) return;
        const data = (await response.json()) as { latitude?: number; longitude?: number };
        if (typeof data.latitude === "number" && typeof data.longitude === "number") {
          setViewTarget({ center: [data.latitude, data.longitude], zoom: 10, key: "home" });
        }
      } catch {
        /* keep the world view */
      }
    })();
  }, []);

  useEffect(() => {
    if (selected && !profiles.some((profile) => profile.id === selected.id)) setSelected(null);
  }, [profiles, selected]);

  const countries = useMemo(
    () => [...new Set(profiles.map((profile) => profile.country).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [profiles],
  );

  const visible = useMemo(() => profiles.filter((profile) => {
    if (country !== "all" && profile.country !== country) return false;
    const haystack = [profile.full_name, profile.username, profile.headline, profile.location_name, profile.country, ...profile.tags, ...profile.services].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [profiles, query, country]);

  const favorites = useMemo(() => profiles.filter((profile) => favoriteIds.includes(profile.id)), [profiles, favoriteIds]);

  const pickedPoint = useMemo<[number, number] | undefined>(() => {
    if (pickedLocation) return [pickedLocation.lat, pickedLocation.lng];
    if (editing && myProfile?.latitude != null && myProfile.longitude != null) return [myProfile.latitude, myProfile.longitude];
    return undefined;
  }, [editing, myProfile, pickedLocation]);

  async function changeCountry(next: string) {
    setCountry(next);
    if (next === "all") {
      setViewTarget({ center: [20, 0], zoom: 2.4, key: "all" });
      return;
    }
    const inCountry = profiles.filter((profile) => profile.country === next && profile.latitude != null && profile.longitude != null);
    const first = inCountry[0];
    if (first?.latitude != null && first.longitude != null) {
      setViewTarget({ center: [first.latitude, first.longitude], zoom: inCountry.length > 1 ? 5 : 9, key: `country-${next}` });
      return;
    }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&country=${encodeURIComponent(next)}`);
      const data = (await response.json()) as { lat: string; lon: string }[];
      const hit = data[0];
      if (hit) setViewTarget({ center: [Number(hit.lat), Number(hit.lon)], zoom: 5, key: `country-${next}` });
    } catch {
      /* keep the current view */
    }
  }

  async function signIn() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin, extraParams: { prompt: "select_account" } });
    if (result.error) toast.error(result.error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setEditing(false); setPicking(false); setSelected(null); setMe(null); setMyProfile(null); setFavoriteIds([]);
    promptedSetup.current = false;
  }

  async function toggleFavorite(profile: MapProfile) {
    if (!me) { void signIn(); return; }
    if (favoriteIds.includes(profile.id)) {
      const { error } = await supabase.from("favorites").delete().eq("user_id", me.id).eq("profile_id", profile.id);
      if (error) { toast.error(error.message); return; }
      setFavoriteIds((ids) => ids.filter((id) => id !== profile.id));
      return;
    }
    const { error } = await supabase.from("favorites").insert({ user_id: me.id, profile_id: profile.id });
    if (error) { toast.error(error.message); return; }
    setFavoriteIds((ids) => [...ids, profile.id]);
    toast.success("Added to your favourites.");
  }

  function openFavorite(profile: MapProfile) {
    setSelected(profile);
    setFavoritesOpen(false);
    if (profile.latitude != null && profile.longitude != null) {
      setViewTarget({ center: [profile.latitude, profile.longitude], zoom: 12, key: `fav-${profile.id}-${Date.now()}` });
    }
  }

  function startPicking() {
    setSelected(null);
    setEditing(false);
    setPicking(true);
  }

  function finishPicking(lat: number, lng: number) {
    setPickedLocation({ lat, lng });
    setPicking(false);
    setEditing(true);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">A</span>Atlaswork</div>
        <div className="search-wrap">
          <Search className="search-icon" size={17} aria-hidden="true" />
          <Input className="search-input" aria-label="Search freelancers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by skill, name or place" />
          <div className="country-filter">
            <Globe2 size={14} aria-hidden="true" />
            <select aria-label="Filter by country" value={country} onChange={(event) => void changeCountry(event.target.value)}>
              <option value="all">All countries</option>
              {countries.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
        <div className="topbar-actions">
          {me && myProfile ? <><Button variant="map" onClick={() => setEditing(true)}><Pencil />My profile</Button><Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sign out"><LogOut /></Button></> : <Button variant="map" onClick={() => void signIn()}><Sparkles />Join the map</Button>}
        </div>
      </header>
      <div className="map-layout" data-picking={picking}>
        <section className="map-stage" aria-label="World map of freelancers">
          {!visible.length && !picking && <div className="map-empty">{profiles.length ? "No freelancers match this search." : "Be the first freelancer to appear here."}</div>}
          {picking && <>
            <div className="map-help">
              <span><LocateFixed size={16} /> Tap the map to drop your exact point</span>
              <Button variant="secondary" size="sm" onClick={() => { setPicking(false); setEditing(true); }}>Cancel</Button>
            </div>
            <div className="pick-reticle" aria-hidden="true" />
          </>}
          <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-muted" />}><Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}><FreelancerMap profiles={visible} selectedId={selected?.id ?? null} onSelect={openFavorite} pickLocation={picking ? finishPicking : undefined} pickedPoint={pickedPoint} focusPoint={pickedPoint} viewTarget={viewTarget} /></Suspense></ClientOnly>
          {!picking && <FavoritesSidebar open={favoritesOpen} onOpenChange={setFavoritesOpen} favorites={favorites} onSelect={openFavorite} onRemove={(profile) => void toggleFavorite(profile)} signedIn={Boolean(me)} />}
          {selected && !picking && <ProfileDetails
            profile={selected}
            viewerId={me?.id ?? null}
            isFavorite={favoriteIds.includes(selected.id)}
            onToggleFavorite={(profile) => void toggleFavorite(profile)}
            onClose={() => setSelected(null)}
            onRequireSignIn={() => void signIn()}
          />}
          {editing && myProfile && <ProfileEditor profile={myProfile} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void loadProfiles(); }} onPickOnMap={startPicking} onLocationFound={(lat, lng) => setPickedLocation({ lat, lng })} pickedLocation={pickedLocation} />}
        </section>
      </div>
    </main>
  );
}
