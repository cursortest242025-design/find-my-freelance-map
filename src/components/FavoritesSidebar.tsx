import { Heart, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MapProfile } from "./FreelancerMap";

export function FavoritesSidebar({
  open,
  onOpenChange,
  favorites,
  onSelect,
  onRemove,
  signedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  favorites: MapProfile[];
  onSelect: (profile: MapProfile) => void;
  onRemove: (profile: MapProfile) => void;
  signedIn: boolean;
}) {
  return (
    <>
      <button type="button" className="fav-handle" data-open={open} onClick={() => onOpenChange(!open)} aria-label="Toggle favourites">
        <Star size={16} />
        <span>Favourites</span>
      </button>
      <aside className="fav-panel" data-open={open} aria-label="Favourite freelancers">
        <div className="fav-head">
          <div><span className="eyebrow">Saved</span><h2>My favourites</h2></div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close favourites"><X /></Button>
        </div>
        {!signedIn && <p className="fav-empty">Sign in to save the freelancers you like.</p>}
        {signedIn && !favorites.length && <p className="fav-empty">No favourites yet. Open a profile and tap Save.</p>}
        <ul className="fav-list">
          {favorites.map((profile) => (
            <li key={profile.id}>
              <button type="button" className="fav-item" onClick={() => onSelect(profile)}>
                <span className="fav-avatar">
                  {profile.avatar_url ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" /> : (profile.full_name || profile.username).slice(0, 1).toUpperCase()}
                </span>
                <span className="fav-copy">
                  <strong>{profile.full_name || `@${profile.username}`}</strong>
                  <span>{profile.headline || profile.location_name}</span>
                </span>
              </button>
              <button type="button" className="fav-remove" onClick={() => onRemove(profile)} aria-label="Remove from favourites"><Heart size={14} /></button>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
