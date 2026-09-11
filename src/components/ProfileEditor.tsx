import { useEffect, useState, type FormEvent } from "react";
import { Check, Crosshair, ImagePlus, MapPin, X } from "lucide-react";
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
  onPickingChange: (active: boolean) => void;
  pickedLocation: { lat: number; lng: number } | null;
};

export function ProfileEditor({ profile, onClose, onSaved, onPickingChange, pickedLocation }: EditorProps) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");

  useEffect(() => () => onPickingChange(false), [onPickingChange]);

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
    const latitude = pickedLocation?.lat ?? profile.latitude;
    const longitude = pickedLocation?.lng ?? profile.longitude;
    const isListed = form.get("listed") === "on";
    if (isListed && (latitude == null || longitude == null)) {
      toast.error("Choose your location on the map before going live.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      username: String(form.get("username") ?? "").trim(),
      full_name: String(form.get("fullName") ?? "").trim(),
      headline: String(form.get("headline") ?? "").trim(),
      bio: String(form.get("bio") ?? "").trim(),
      location_name: String(form.get("locationName") ?? "").trim(),
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
    if (error) return toast.error(error.message);
    onPickingChange(false);
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
        <div><Label htmlFor="locationName">Location label</Label><Input id="locationName" name="locationName" defaultValue={profile.location_name} placeholder="Lisbon, Portugal" /></div>
        <Button type="button" variant="outline" className="w-full" onClick={() => onPickingChange(true)}><Crosshair />{pickedLocation ? `${pickedLocation.lat.toFixed(4)}, ${pickedLocation.lng.toFixed(4)}` : profile.latitude != null ? "Change exact map point" : "Choose exact point on map"}</Button>
        <div className="privacy-note"><MapPin /><p>Your exact map point will be visible publicly when your profile is listed.</p></div>
        <div className="toggle-row"><div><Label htmlFor="available">Available for work</Label><p>Show clients you can take new projects.</p></div><Switch id="available" name="available" defaultChecked={profile.is_available} /></div>
        <div className="toggle-row"><div><Label htmlFor="listed">List me on the map</Label><p>Make your profile discoverable to everyone.</p></div><Switch id="listed" name="listed" defaultChecked={profile.is_listed} /></div>
        <div className="portfolio-upload"><div><Label htmlFor="projectTitle">Portfolio project</Label><Input id="projectTitle" value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} placeholder="Project title" /></div><div><Label htmlFor="projectImage">Demo image</Label><Input id="projectImage" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProject(file); }} /></div></div>
        <Button type="submit" size="lg" disabled={saving || uploading}><Check />{saving ? "Saving..." : "Save profile"}</Button>
      </form>
    </aside>
  );
}