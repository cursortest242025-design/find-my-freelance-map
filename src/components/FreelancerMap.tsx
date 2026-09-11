import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
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

const markerIcon = L.divIcon({
  className: "person-pin",
  html: '<span class="person-pin-dot"></span>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -22],
});

const selectedIcon = L.divIcon({
  className: "person-pin person-pin-selected",
  html: '<span class="person-pin-dot"></span>',
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -24],
});

function LocationPicker({ onPick }: { onPick: ((lat: number, lng: number) => void) | undefined }) {
  useMapEvents({
    click(event) {
      onPick?.(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function FitToProfiles({ profiles }: { profiles: MapProfile[] }) {
  const map = useMapEvents({});
  useEffect(() => {
    const points = profiles
      .filter((profile) => profile.latitude != null && profile.longitude != null)
      .map((profile) => [profile.latitude as number, profile.longitude as number] as [number, number]);
    const firstPoint = points[0];
    if (points.length === 1 && firstPoint) map.setView(firstPoint, 9);
    if (points.length > 1) map.fitBounds(points, { padding: [70, 70], maxZoom: 11 });
  }, [map, profiles]);
  return null;
}

export function FreelancerMap({
  profiles,
  selectedId,
  onSelect,
  pickLocation,
}: {
  profiles: MapProfile[];
  selectedId: string | null;
  onSelect: (profile: MapProfile) => void;
  pickLocation: ((lat: number, lng: number) => void) | undefined;
}) {
  return (
    <MapContainer center={[20, 0]} zoom={2.4} minZoom={2} className="h-full w-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToProfiles profiles={profiles} />
      <LocationPicker onPick={pickLocation} />
      {profiles.map((profile) =>
        profile.latitude != null && profile.longitude != null ? (
          <Marker
            key={profile.id}
            position={[profile.latitude, profile.longitude]}
            icon={profile.id === selectedId ? selectedIcon : markerIcon}
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
    </MapContainer>
  );
}