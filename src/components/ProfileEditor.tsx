import { useState, type FormEvent } from "react";
import { Check, Crosshair, ImagePlus, LocateFixed, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { MapProfile } from "./FreelancerMap";

type EditorProps = {
  profile: MapProfile;
  onClose: () => void;
  onSaved: () => void;
  onPickOnMap: () => void;
  onLocationFound: (lat: number, lng: number) => void;
  pickedLocation: { lat: number; lng: number } | null;
};

export function ProfileEditor({ profile, onClose, onSaved, onPickOnMap, onLocationFound, pickedLocation }: EditorProps) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [locationName, setLocationName] = useState(profile.location_name);
  const [country, setCountry] = useState(profile.country);

  const latitude = pickedLocation?.lat ?? profile.latitude;
  const longitude = pickedLocation?.lng ?? profile.longitude;

  async function fillLocationName(lat: number, lng: number) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lng}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as { address?: Record<string, string> };
      const address = data.address ?? {};
      const city = address['city'] || address['town'] || address['village'] || address['state'] || "";
      const country = address['country'] || "";
      const label = [city, country].filter(Boolean).join(", ");
      if (label) setLocationName(label);
      if (country) setCountry(country);
    } catch {
      /* keep whatever the user typed */
    }
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Your device does not support location access.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onLocationFound(position.coords.latitude, position.coords.longitude);
        void fillLocationName(position.coords.latitude, position.coords.longitude);
        toast.success("Location captured from your device.");
      },
      (error) => {
        setLocating(false);
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied. Allow it in your browser or pick your point manually."
            : "Could not read your location. Try picking your point manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${profile.id}/avatar-${Date.now()}.${extension}`;
    const upload = await supabase.storage.from("freelancer-media").upload(path, file, { upsert: true });
    if (upload.error) {
      toast.error(upload.error.message);
      setUploading(false);
      return;
    }
    const signed = await supabase.storage.from("freelancer-media").createSignedUrl(path, 31536000);
    if (signed.error) toast.error(signed.error.message);
    else setAvatarUrl(signed.data.signedUrl);
    setUploading(false);
  }

  async function uploadProject(file: File): Promise<void> {
    if (!projectTitle.trim()) { toast.error("Add a project title first."); return; }
    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${profile.id}/work-${Date.now()}.${extension}`;
    const upload = await supabase.storage.from("freelancer-media").upload(path, file);
    if (upload.error) { setUploading(false); toast.error(upload.error.message); return; }
    const signed = await supabase.storage.from("freelancer-media").createSignedUrl(path, 31536000);
    if (signed.error) { setUploading(false); toast.error(signed.error.message); return; }
    const created = await supabase.from("portfolio_items").insert({ profile_id: profile.id, title: projectTitle.trim(), image_url: signed.data.signedUrl });
    setUploading(false);
    if (created.error) { toast.error(created.error.message); return; }
    setProjectTitle("");
    toast.success("Portfolio project added.");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tags = String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
    const services = String(form.get("services") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const priceText = String(form.get("price") ?? "").trim();
    const isListed = form.get("listed") === "on";
    const githubRepos = String(form.get("githubRepos") ?? "").split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
    if (isListed && (latitude == null || longitude == null)) {
      toast.error("Set your location before going live.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      username: String(form.get("username") ?? "").trim(),
      full_name: String(form.get("fullName") ?? "").trim(),
      headline: String(form.get("headline") ?? "").trim(),
      bio: String(form.get("bio") ?? "").trim(),
      location_name: locationName.trim(),
      country: country.trim(),
      contact_email: String(form.get("contactEmail") ?? "").trim(),
      linkedin_url: String(form.get("linkedin") ?? "").trim(),
      instagram_url: String(form.get("instagram") ?? "").trim(),
      whatsapp_number: String(form.get("whatsapp") ?? "").trim(),
      telegram_id: String(form.get("telegram") ?? "").trim(),
      address: String(form.get("address") ?? "").trim(),
      show_address: form.get("showAddress") === "on",
      github_repos: githubRepos,
      latitude,
      longitude,
      tags,
      services,
      starting_price: priceText ? Number(priceText) : null,
      currency: String(form.get("currency") ?? "USD").toUpperCase(),
      avatar_url: avatarUrl || null,
      is_available: form.get("available") === "on",
      is_listed: isListed,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Your freelancer profile is live.");
    onSaved();
  }

  return (
    <aside className="editor-panel" aria-label="Edit freelancer profile">
      <div className="editor-heading">
        <div><span className="eyebrow">Your presence</span><h2>Build your map profile</h2></div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close profile editor"><X /></Button>
      </div>
      <form onSubmit={save} className="editor-form">
        <div className="avatar-row">
          <div className="avatar-preview">{avatarUrl ? <img src={avatarUrl} alt="Profile preview" /> : <ImagePlus />}</div>
          <div><Label htmlFor="avatar">Profile picture</Label><p>JPG, PNG or WebP, up to 8 MB</p>
            <Input id="avatar" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAvatar(file); }} />
          </div>
        </div>
        <div className="field-grid"><div><Label htmlFor="fullName">Name</Label><Input id="fullName" name="fullName" defaultValue={profile.full_name} required /></div><div><Label htmlFor="username">Username</Label><Input id="username" name="username" defaultValue={profile.username} required /></div></div>
        <div><Label htmlFor="headline">Professional headline</Label><Input id="headline" name="headline" defaultValue={profile.headline} placeholder="Brand designer & creative director" /></div>
        <div><Label htmlFor="bio">About your work</Label><Textarea id="bio" name="bio" defaultValue={profile.bio} placeholder="Tell clients what you do best..." rows={4} /></div>
        <div><Label htmlFor="services">Services</Label><Input id="services" name="services" defaultValue={profile.services.join(", ")} placeholder="Brand identity, Web design, Art direction" /><p className="field-help">Separate services with commas.</p></div>
        <div><Label htmlFor="tags">Skills & tools</Label><Input id="tags" name="tags" defaultValue={profile.tags.join(", ")} placeholder="Figma, Illustration, Framer" /></div>
        <div className="field-grid"><div><Label htmlFor="price">Starting price</Label><Input id="price" name="price" type="number" min="0" step="1" defaultValue={profile.starting_price ?? ""} placeholder="Optional" /></div><div><Label htmlFor="currency">Currency</Label><Input id="currency" name="currency" maxLength={3} defaultValue={profile.currency} /></div></div>
        <div className="location-block">
          <Label htmlFor="locationName">Where you are</Label>
          <Input id="locationName" value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Lisbon, Portugal" />
          <div className="location-choices">
            <Button type="button" variant="outline" disabled={locating} onClick={useCurrentLocation}><LocateFixed />{locating ? "Locating..." : "Use my current location"}</Button>
            <Button type="button" variant="outline" onClick={onPickOnMap}><Crosshair />Manually pick on map</Button>
          </div>
          <p className="field-help" data-set={latitude != null}>
            {latitude != null && longitude != null ? `Pinned at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : "No point set yet."}
          </p>
        </div>
        <div className="section-split"><span className="eyebrow">Contact points</span><p className="field-help">All of these are optional.</p></div>
        <div className="field-grid">
          <div><Label htmlFor="contactEmail">Email ID</Label><Input id="contactEmail" name="contactEmail" type="email" defaultValue={profile.contact_email} placeholder="you@studio.com" /></div>
          <div><Label htmlFor="linkedin">LinkedIn</Label><Input id="linkedin" name="linkedin" defaultValue={profile.linkedin_url} placeholder="linkedin.com/in/you" /></div>
          <div><Label htmlFor="instagram">Instagram</Label><Input id="instagram" name="instagram" defaultValue={profile.instagram_url} placeholder="instagram.com/you" /></div>
          <div><Label htmlFor="whatsapp">WhatsApp number</Label><Input id="whatsapp" name="whatsapp" defaultValue={profile.whatsapp_number} placeholder="+91 90000 00000" /></div>
          <div><Label htmlFor="telegram">Telegram ID</Label><Input id="telegram" name="telegram" defaultValue={profile.telegram_id} placeholder="@yourhandle" /></div>
          <div><Label htmlFor="githubRepos">GitHub repositories</Label><Input id="githubRepos" name="githubRepos" defaultValue={profile.github_repos.join(", ")} placeholder="github.com/you/project" /><p className="field-help">Separate links with commas.</p></div>
        </div>
        <div><Label htmlFor="address">Address</Label><Textarea id="address" name="address" defaultValue={profile.address} rows={2} placeholder="Street, area, city, postcode" /></div>
        <div className="toggle-row"><div><Label htmlFor="showAddress">Show my address publicly</Label><p>Keep it off to share only your city and map point.</p></div><Switch id="showAddress" name="showAddress" defaultChecked={profile.show_address} /></div>
        <div className="privacy-note"><MapPin /><p>Your exact map point will be visible publicly when your profile is listed.</p></div>
        <div className="toggle-row"><div><Label htmlFor="available">Available for work</Label><p>Show clients you can take new projects.</p></div><Switch id="available" name="available" defaultChecked={profile.is_available} /></div>
        <div className="toggle-row"><div><Label htmlFor="listed">List me on the map</Label><p>Make your profile discoverable to everyone.</p></div><Switch id="listed" name="listed" defaultChecked={profile.is_listed} /></div>
        <div className="portfolio-upload"><div><Label htmlFor="projectTitle">Portfolio project</Label><Input id="projectTitle" value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} placeholder="Project title" /></div><div><Label htmlFor="projectImage">Demo image</Label><Input id="projectImage" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProject(file); }} /></div></div>
        <Button type="submit" size="lg" disabled={saving || uploading}><Check />{saving ? "Saving..." : "Save profile"}</Button>
      </form>
    </aside>
  );
}
