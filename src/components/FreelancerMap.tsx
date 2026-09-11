import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
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
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === '"' ? "&quot;" : "&#39;",
  );
}

function buildIcon(profile: MapProfile, size: number, selected: boolean) {
  const initial = escapeHtml((profile.full_name || profile.username || "?").slice(0, 1).toUpperCase());
  const face = profile.avatar_url
    ? `<img src="${escapeHtml(profile.avatar_url)}" alt="" />`
    : `<span class="pin3d-initial">${initial}</span>`;
  return L.divIcon({
    className: `pin3d${selected ? " pin3d-selected" : ""}${profile.is_available ? " pin3d-available" : ""}`,
    html: `<span class="pin3d-body" style="--pin-size:${size}px"><span class="pin3d-face">${face}</span></span><span class="pin3d-shadow"></span>`,
    iconSize: [size, size * 1.35],
    iconAnchor: [size / 2, size * 1.35],
    popupAnchor: [0, -size * 1.3],
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

function FitToProfiles({ profiles, focus }: { profiles: MapProfile[]; focus: [number, number] | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.setView(focus, Math.max(map.getZoom(), 12));
      return;
    }
    const points = profiles
      .filter((profile) => profile.latitude != null && profile.longitude != null)
      .map((profile) => [profile.latitude as number, profile.longitude as number] as [number, number]);
    const firstPoint = points[0];
    if (points.length === 1 && firstPoint) map.setView(firstPoint, 9);
    if (points.length > 1) map.fitBounds(points, { padding: [70, 70], maxZoom: 11 });
  }, [map, profiles, focus]);
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
            eventHandlers={{ click: () => onSelect(profile) }}
          >
            <Popup>
              <button className="map-popup" type="button" onClick={() => onSelect(profile)}>
                <strong>{profile.full_name || `@${profile.username}`}</strong>
                <span>{profile.headline || profile.services[0] || "Independent freelancer"}</span>
              </button>
            </Popup>
          </Marker>
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
        html: '<span class="pin3d-body" style="--pin-size:38px"><span class="pin3d-face"><span class="pin3d-initial">★</span></span></span><span class="pin3d-shadow"></span>',
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
}: {
  profiles: MapProfile[];
  selectedId: string | null;
  onSelect: (profile: MapProfile) => void;
  pickLocation: ((lat: number, lng: number) => void) | undefined;
  pickedPoint?: [number, number] | undefined;
  focusPoint?: [number, number] | undefined;
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
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitToProfiles profiles={profiles} focus={focusPoint} />
      <LocationPicker onPick={pickLocation} />
      <Markers profiles={profiles} selectedId={selectedId} onSelect={onSelect} />
      {pickedPoint && <PickedMarker point={pickedPoint} />}
    </MapContainer>
  );
}
