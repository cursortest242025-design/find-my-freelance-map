import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapProfile = {
  id: string;
  username: string;
  full_name: string;
  headline: string;
  bio: string;
  avatar_url: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string;
  tags: string[];
  services: string[];
  starting_price: number | null;
  currency: string;
  is_available: boolean;
  is_listed: boolean;
  contact_email: string;
  linkedin_url: string;
  instagram_url: string;
  whatsapp_number: string;
  telegram_id: string;
  address: string;
  show_address: boolean;
  github_repos: string[];
  country: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === '"' ? "&quot;" : "&#39;",
  );
}

function buildIcon(profile: MapProfile, size: number, selected: boolean) {
  const initial = escapeHtml((profile.full_name || profile.username || "?").slice(0, 1).toUpperCase());
  // Always render the silhouette as a base layer so the photo simply covers it when it loads.
  const fallback = `<span class="pin3d-person" aria-hidden="true"><span class="pin3d-head"></span><span class="pin3d-shoulders"></span><span class="pin3d-initial">${initial}</span></span>`;
  const photo = profile.avatar_url
    ? `<img class="pin3d-photo" src="${escapeHtml(profile.avatar_url)}" alt="" loading="eager" decoding="async" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="this.style.display='none'" />`
    : "";
  const face = `${fallback}${photo}`;
  return L.divIcon({
    className: `pin3d${selected ? " pin3d-selected" : ""}${profile.is_available ? " pin3d-available" : ""}`,
    html: `<span class="pin3d-body" style="--pin-size:${size}px"><span class="pin3d-face">${face}</span><span class="pin3d-status"></span></span><span class="pin3d-tail"></span><span class="pin3d-shadow"></span>`,
    iconSize: [size, size * 1.42],
    iconAnchor: [size / 2, size * 1.42],
  });
}

function LocationPicker({ onPick }: { onPick: ((lat: number, lng: number) => void) | undefined }) {
  useMapEvents({
    click(event) {
      onPick?.(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export type ViewTarget = { center: [number, number]; zoom: number; key: string };

function FitToProfiles({ profiles, focus }: { profiles: MapProfile[]; focus: [number, number] | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.setView(focus, Math.max(map.getZoom(), 12));
  }, [map, profiles, focus]);
  return null;
}

function ViewController({ target }: { target: ViewTarget | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo(target.center, target.zoom, { duration: 1.1 });
  }, [map, target?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Markers({
  profiles,
  selectedId,
  onSelect,
}: {
  profiles: MapProfile[];
  selectedId: string | null;
  onSelect: (profile: MapProfile) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  // Pins grow with zoom so they stay readable when zoomed in and unobtrusive when zoomed out.
  const size = useMemo(() => Math.round(Math.min(46, Math.max(20, 18 + (zoom - 2) * 1.9))), [zoom]);

  return (
    <>
      {profiles.map((profile) =>
        profile.latitude != null && profile.longitude != null ? (
          <Marker
            key={profile.id}
            position={[profile.latitude, profile.longitude]}
            icon={buildIcon(profile, profile.id === selectedId ? Math.round(size * 1.18) : size, profile.id === selectedId)}
            eventHandlers={{
              click: (event) => {
                event.originalEvent.stopPropagation();
                map.closePopup();
                onSelect(profile);
              },
            }}
            riseOnHover
            riseOffset={800}
            title={`Open ${profile.full_name || profile.username}'s profile`}
          />
        ) : null,
      )}
    </>
  );
}

function PickedMarker({ point }: { point: [number, number] }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "pin3d pin3d-picked",
        html: '<span class="pin3d-body" style="--pin-size:38px"><span class="pin3d-face"><span class="pin3d-person"><span class="pin3d-head"></span><span class="pin3d-shoulders"></span></span></span></span><span class="pin3d-tail"></span><span class="pin3d-shadow"></span>',
        iconSize: [38, 51],
        iconAnchor: [19, 51],
      }),
    [],
  );
  return <Marker position={point} icon={icon} />;
}

export function FreelancerMap({
  profiles,
  selectedId,
  onSelect,
  pickLocation,
  pickedPoint,
  focusPoint,
  viewTarget,
}: {
  profiles: MapProfile[];
  selectedId: string | null;
  onSelect: (profile: MapProfile) => void;
  pickLocation: ((lat: number, lng: number) => void) | undefined;
  pickedPoint?: [number, number] | undefined;
  focusPoint?: [number, number] | undefined;
  viewTarget?: ViewTarget | undefined;
}) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2.4}
      minZoom={2}
      maxZoom={19}
      wheelPxPerZoomLevel={110}
      zoomSnap={0}
      zoomDelta={0.6}
      className="h-full w-full atlas-map"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={20}
      />
      <ViewController target={viewTarget} />
      <FitToProfiles profiles={profiles} focus={focusPoint} />
      <LocationPicker onPick={pickLocation} />
      <Markers profiles={profiles} selectedId={selectedId} onSelect={onSelect} />
      {pickedPoint && <PickedMarker point={pickedPoint} />}
    </MapContainer>
  );
}
