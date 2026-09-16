import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { MapMouseEvent, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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

export type ViewTarget = { center: [number, number]; zoom: number; key: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === '"' ? "&quot;" : "&#39;",
  );
}

// Globe view of the planet with crisp raster imagery; MapLibre renders it on the GPU so
// zooming is continuous instead of the stepped, scroll-heavy feel of a tiled 2D map.
const globeStyle: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  light: { anchor: "map", position: [1.2, 200, 40], intensity: 0.2 },
  sky: {
    "sky-color": "#5b8dd6",
    "sky-horizon-blend": 0.55,
    "horizon-color": "#d9e7f5",
    "horizon-fog-blend": 0.6,
    "fog-color": "#eaf1f8",
    "fog-ground-blend": 0.05,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 0.6, 8, 0],
  },
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: "space", type: "background", paint: { "background-color": "#0b1224" } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-resampling": "linear", "raster-fade-duration": 120 } },
  ],
};

function pinSize(zoom: number) {
  return Math.round(Math.min(48, Math.max(20, 18 + (zoom - 1) * 2)));
}

function buildPinElement(profile: MapProfile) {
  const element = document.createElement("div");
  const initial = escapeHtml((profile.full_name || profile.username || "?").slice(0, 1).toUpperCase());
  const fallback = `<span class="pin3d-person" aria-hidden="true"><span class="pin3d-head"></span><span class="pin3d-shoulders"></span><span class="pin3d-initial">${initial}</span></span>`;
  const photo = profile.avatar_url
    ? `<img class="pin3d-photo" src="${escapeHtml(profile.avatar_url)}" alt="" loading="eager" decoding="async" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="this.style.display='none'" />`
    : "";
  element.className = "pin3d";
  element.title = `Open ${profile.full_name || profile.username}'s profile`;
  element.innerHTML = `<span class="pin3d-body"><span class="pin3d-face">${fallback}${photo}</span><span class="pin3d-status"></span></span><span class="pin3d-tail"></span><span class="pin3d-shadow"></span>`;
  return element;
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const pickedRef = useRef<maplibregl.Marker | null>(null);
  const pickHandler = useRef(pickLocation);
  const selectHandler = useRef(onSelect);
  pickHandler.current = pickLocation;
  selectHandler.current = onSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    const map = new maplibregl.Map({
      container,
      style: globeStyle,
      center: [0, 20],
      zoom: 1.4,
      minZoom: 0.6,
      maxZoom: 19,
      attributionControl: { compact: true },
      dragRotate: true,
      pitchWithRotate: true,
      maxPitch: 72,
      fadeDuration: 120,
    });
    mapRef.current = map;
    // Faster, smoother wheel/trackpad zoom: fewer scrolls per zoom level, GPU-interpolated.
    map.scrollZoom.setWheelZoomRate(1 / 160);
    map.scrollZoom.setZoomRate(1 / 60);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), "bottom-right");
    map.touchZoomRotate.enableRotation();

    const applySizes = () => {
      const size = pinSize(map.getZoom());
      for (const [id, marker] of markersRef.current) {
        const element = marker.getElement();
        const body = element.querySelector<HTMLElement>(".pin3d-body");
        const scaled = element.classList.contains("pin3d-selected") ? Math.round(size * 1.18) : size;
        if (body) body.style.setProperty("--pin-size", `${scaled}px`);
        void id;
      }
    };
    map.on("zoom", applySizes);
    map.on("click", (event: MapMouseEvent) => pickHandler.current?.(event.lngLat.lat, event.lngLat.lng));
    map.once("load", applySizes);

    return () => {
      markersRef.current.clear();
      pickedRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers with the visible freelancers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const seen = new Set<string>();
    for (const profile of profiles) {
      if (profile.latitude == null || profile.longitude == null) continue;
      seen.add(profile.id);
      let marker = markers.get(profile.id);
      if (!marker) {
        const element = buildPinElement(profile);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          selectHandler.current(profile);
        });
        marker = new maplibregl.Marker({ element, anchor: "bottom", pitchAlignment: "viewport", rotationAlignment: "viewport" })
          .setLngLat([profile.longitude, profile.latitude])
          .addTo(map);
        markers.set(profile.id, marker);
      } else {
        marker.setLngLat([profile.longitude, profile.latitude]);
      }
      const element = marker.getElement();
      element.classList.toggle("pin3d-selected", profile.id === selectedId);
      element.classList.toggle("pin3d-available", profile.is_available);
      const body = element.querySelector<HTMLElement>(".pin3d-body");
      const size = pinSize(map.getZoom());
      if (body) body.style.setProperty("--pin-size", `${profile.id === selectedId ? Math.round(size * 1.18) : size}px`);
    }
    for (const [id, marker] of markers) {
      if (seen.has(id)) continue;
      marker.remove();
      markers.delete(id);
    }
  }, [profiles, selectedId]);

  // Marker for the point being chosen while setting up a profile.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pickedPoint) {
      pickedRef.current?.remove();
      pickedRef.current = null;
      return;
    }
    if (!pickedRef.current) {
      const element = document.createElement("div");
      element.className = "pin3d pin3d-picked";
      element.innerHTML =
        '<span class="pin3d-body" style="--pin-size:38px"><span class="pin3d-face"><span class="pin3d-person"><span class="pin3d-head"></span><span class="pin3d-shoulders"></span></span></span></span><span class="pin3d-tail"></span><span class="pin3d-shadow"></span>';
      pickedRef.current = new maplibregl.Marker({ element, anchor: "bottom", pitchAlignment: "viewport", rotationAlignment: "viewport" })
        .setLngLat([pickedPoint[1], pickedPoint[0]])
        .addTo(map);
    } else {
      pickedRef.current.setLngLat([pickedPoint[1], pickedPoint[0]]);
    }
  }, [pickedPoint]);

  // Google-Earth style swoop to a chosen country, favourite or the visitor's own city.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewTarget) return;
    map.flyTo({
      center: [viewTarget.center[1], viewTarget.center[0]],
      zoom: viewTarget.zoom,
      pitch: viewTarget.zoom > 6 ? 45 : 0,
      bearing: 0,
      curve: 1.5,
      speed: 0.85,
      essential: true,
    });
  }, [viewTarget?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    map.easeTo({ center: [focusPoint[1], focusPoint[0]], zoom: Math.max(map.getZoom(), 12), duration: 900 });
  }, [focusPoint]);

  return <div ref={containerRef} className="atlas-map h-full w-full" />;
}
