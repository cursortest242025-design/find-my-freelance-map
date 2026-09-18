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
  const [projectCategory, setProjectCategory] = useState("");
  const [projectClient, setProjectClient] = useState("");
  const [projectYear, setProjectYear] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectTools, setProjectTools] = useState("");
  const [projectResults, setProjectResults] = useState("");
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

  async function uploadProjects(files: File[]): Promise<void> {
    const title = projectTitle.trim();
    if (!title) {
      toast.error("Add a project title before uploading screenshots.");
      return;
    }
    setUploading(true);
    const imageUrls: string[] = [];
    for (const [index, file] of files.entries()) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.id}/work-${Date.now()}-${index}.${extension}`;
      const upload = await supabase.storage.from("freelancer-media").upload(path, file);
      if (upload.error) { toast.error(upload.error.message); continue; }
      const signed = await supabase.storage.from("freelancer-media").createSignedUrl(path, 31536000);
      if (signed.error) { toast.error(signed.error.message); continue; }
      imageUrls.push(signed.data.signedUrl);
    }
    if (!imageUrls.length) { setUploading(false); return; }
    const year = projectYear ? Number(projectYear) : null;
    const created = await supabase.from("portfolio_items").insert({
      profile_id: profile.id,
      title,
      category: projectCategory.trim(),
      client_name: projectClient.trim(),
      completion_year: year,
      project_url: projectUrl.trim(),
      description: projectDescription.trim(),
      tools: projectTools.split(",").map((tool) => tool.trim()).filter(Boolean),
      results: projectResults.trim(),
      image_url: imageUrls[0],
      image_urls: imageUrls,
      sort_order: Date.now(),
    });
    setUploading(false);
    if (created.error) { toast.error(created.error.message); return; }
    setProjectTitle(""); setProjectCategory(""); setProjectClient(""); setProjectYear("");
    setProjectUrl(""); setProjectDescription(""); setProjectTools(""); setProjectResults("");
    toast.success(`Project added with ${imageUrls.length} screenshot${imageUrls.length > 1 ? "s" : ""}.`);
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
      country: (country.trim() || locationName.split(",").pop()?.trim() || ""),
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
        <div className="portfolio-builder">
          <div className="section-split"><span className="eyebrow">Past work</span><p className="field-help">Build one clear case study at a time.</p></div>
          <div><Label htmlFor="projectTitle">Project title</Label><Input id="projectTitle" value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} placeholder="Mobile banking redesign" /></div>
          <div className="field-grid">
            <div><Label htmlFor="projectCategory">Service or category</Label><Input id="projectCategory" value={projectCategory} onChange={(event) => setProjectCategory(event.target.value)} placeholder="Product design" /></div>
            <div><Label htmlFor="projectClient">Client or company</Label><Input id="projectClient" value={projectClient} onChange={(event) => setProjectClient(event.target.value)} placeholder="Optional" /></div>
            <div><Label htmlFor="projectYear">Completion year</Label><Input id="projectYear" type="number" min="1900" max="2100" value={projectYear} onChange={(event) => setProjectYear(event.target.value)} placeholder="2026" /></div>
            <div><Label htmlFor="projectUrl">Live project link</Label><Input id="projectUrl" type="url" value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} placeholder="https://…" /></div>
          </div>
          <div><Label htmlFor="projectDescription">Project overview</Label><Textarea id="projectDescription" rows={3} value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="What was the challenge and what did you create?" /></div>
          <div><Label htmlFor="projectTools">Tools and skills</Label><Input id="projectTools" value={projectTools} onChange={(event) => setProjectTools(event.target.value)} placeholder="Figma, React, Research" /><p className="field-help">Separate each item with a comma.</p></div>
          <div><Label htmlFor="projectResults">Outcome or results</Label><Textarea id="projectResults" rows={2} value={projectResults} onChange={(event) => setProjectResults(event.target.value)} placeholder="Share a measurable result, client response, or impact." /></div>
          <div className="portfolio-upload"><div><Label htmlFor="projectImage">Project screenshots</Label><Input id="projectImage" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) void uploadProjects(files); }} /><p className="field-help">{uploading ? "Uploading project..." : "Select every screenshot for this project together."}</p></div></div>
        </div>
        <Button type="submit" size="lg" disabled={saving || uploading}><Check />{saving ? "Saving..." : "Save profile"}</Button>
      </form>
    </aside>
  );
}
