import { useCallback, useEffect, useRef, useState } from "react";
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
    "horizon-fog-blend": 0.2,
    "fog-color": "#cfe1f2",
    "fog-ground-blend": 0.85,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.75, 5, 0.4, 8, 0],
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

function buildClusterElement(count: number, label: string) {
  const element = document.createElement("div");
  element.className = "pin-cluster";
  element.title = `${count} freelancers${label ? ` around ${label}` : ""} — zoom in to see them`;
  element.innerHTML = `<span class="pin-cluster-bubble"><span class="pin-cluster-count">${count}</span></span><span class="pin-cluster-pulse"></span>`;
  return element;
}

type Group = { key: string; lat: number; lng: number; members: MapProfile[] };

// Group nearby people into one counted bubble while the view is wide, so a busy
// region reads as "42 freelancers" instead of a pile of overlapping pins.
function groupProfiles(profiles: MapProfile[], zoom: number): Group[] {
  const placed = profiles.filter((profile) => profile.latitude != null && profile.longitude != null);
  if (zoom >= 9) {
    return placed.map((profile) => ({
      key: profile.id,
      lat: profile.latitude as number,
      lng: profile.longitude as number,
      members: [profile],
    }));
  }
  const cell = Math.max(0.05, 40 / Math.pow(2, zoom));
  const buckets = new Map<string, Group>();
  for (const profile of placed) {
    const lat = profile.latitude as number;
    const lng = profile.longitude as number;
    const key = `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.members.push(profile);
      bucket.lat = (bucket.lat * (bucket.members.length - 1) + lat) / bucket.members.length;
      bucket.lng = (bucket.lng * (bucket.members.length - 1) + lng) / bucket.members.length;
    } else {
      buckets.set(key, { key, lat, lng, members: [profile] });
    }
  }
  return [...buckets.values()].map((group) =>
    group.members.length === 1 && group.members[0] ? { ...group, key: group.members[0].id } : group,
  );
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
  const spinningRef = useRef(true);
  const [zoomBucket, setZoomBucket] = useState(1);
  pickHandler.current = pickLocation;
  selectHandler.current = onSelect;

  // Hide anything sitting on the far side of the planet so pins never bleed
  // through the globe from the back.
  const applyOcclusion = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const transform = (map as unknown as { transform?: { isLocationOccluded?: (point: maplibregl.LngLat) => boolean } })
      .transform;
    const check = transform?.isLocationOccluded?.bind(transform);
    const hideIfBehind = (marker: maplibregl.Marker) => {
      const element = marker.getElement();
      const hidden = check ? check(marker.getLngLat()) : false;
      element.style.visibility = hidden ? "hidden" : "visible";
      element.style.pointerEvents = hidden ? "none" : "";
    };
    for (const marker of markersRef.current.values()) hideIfBehind(marker);
    if (pickedRef.current) hideIfBehind(pickedRef.current);
  }, []);

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

    const stopSpinning = () => { spinningRef.current = false; };
    map.on("mousedown", stopSpinning);
    map.on("touchstart", stopSpinning);
    map.on("wheel", stopSpinning);
    const rotate = () => {
      if (!spinningRef.current || map.getZoom() > 2.5) return;
      const center = map.getCenter();
      center.lng -= 0.035;
      map.easeTo({ center, duration: 1000, easing: (value) => value });
    };
    map.on("moveend", rotate);
    map.once("load", rotate);

    const applySizes = () => {
      const size = pinSize(map.getZoom());
      for (const marker of markersRef.current.values()) {
        const element = marker.getElement();
        const body = element.querySelector<HTMLElement>(".pin3d-body");
        const scaled = element.classList.contains("pin3d-selected") ? Math.round(size * 1.18) : size;
        if (body) body.style.setProperty("--pin-size", `${scaled}px`);
      }
    };
    map.on("zoom", applySizes);
    map.on("render", applyOcclusion);
    map.on("zoomend", () => {
      setZoomBucket(Math.round(map.getZoom() * 2) / 2);
      // Level out to a straight-on globe view when the user pulls back out to world scale.
      if (map.getZoom() < 5 && map.getPitch() > 1) map.easeTo({ pitch: 0, duration: 500 });
    });
    map.on("click", (event: MapMouseEvent) => pickHandler.current?.(event.lngLat.lat, event.lngLat.lng));
    map.once("load", applySizes);

    return () => {
      markersRef.current.clear();
      pickedRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [applyOcclusion]);

  // Sync markers (people and grouped bubbles) with the visible freelancers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const groups = groupProfiles(profiles, zoomBucket);
    const seen = new Set<string>();
    const size = pinSize(map.getZoom());
    for (const group of groups) {
      seen.add(group.key);
      const single = group.members.length === 1 ? group.members[0] : null;
      const existing = markers.get(group.key);
      const isClusterMarker = existing?.getElement().classList.contains("pin-cluster");
      if (existing && Boolean(single) === !isClusterMarker) {
        existing.setLngLat([group.lng, group.lat]);
      } else {
        existing?.remove();
        const element = single
          ? buildPinElement(single)
          : buildClusterElement(group.members.length, group.members[0]?.location_name ?? "");
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          if (single) {
            selectHandler.current(single);
            return;
          }
          map.flyTo({ center: [group.lng, group.lat], zoom: Math.max(map.getZoom() + 3, 6), essential: true });
        });
        const marker = new maplibregl.Marker({
          element,
          anchor: single ? "bottom" : "center",
          pitchAlignment: "viewport",
          rotationAlignment: "viewport",
        })
          .setLngLat([group.lng, group.lat])
          .addTo(map);
        markers.set(group.key, marker);
      }
      if (single) {
        const element = markers.get(group.key)!.getElement();
        element.classList.toggle("pin3d-selected", single.id === selectedId);
        element.classList.toggle("pin3d-available", single.is_available);
        const body = element.querySelector<HTMLElement>(".pin3d-body");
        if (body) body.style.setProperty("--pin-size", `${single.id === selectedId ? Math.round(size * 1.18) : size}px`);
      }
    }
    for (const [key, marker] of markers) {
      if (seen.has(key)) continue;
      marker.remove();
      markers.delete(key);
    }
    applyOcclusion();
  }, [profiles, selectedId, zoomBucket, applyOcclusion]);

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
    spinningRef.current = false;
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
