"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapProspect {
  id: string;
  name: string;
  rank: number;
  gbp_score: number;
  rating: number | null;
  reviews: number | null;
  phone: string;
  website?: string | null;
  address?: string | null;
  maps_url?: string | null;
  lat?: number;
  lng?: number;
}

interface Props {
  prospects: MapProspect[];
  center: { lat: number; lng: number };
  hoveredId: string | null;
  selectedId?: string | null;
  onHover: (id: string | null) => void;
  onSelect?: (id: string) => void;
}

/* -- Pin-shaped SVG marker -- */
function createPinIcon(rank: number, isHovered: boolean, hasWebsite: boolean, isSelected: boolean): L.DivIcon {
  const scale = isSelected ? 1.35 : isHovered ? 1.25 : 1;
  const w = Math.round(30 * scale);
  const h = Math.round(42 * scale);

  const fill =
    rank === 1
      ? "#f59e0b"
      : rank <= 3
        ? "#10b981"
        : rank <= 7
          ? "#8b5cf6"
          : "#6b7280";

  const stroke = isSelected ? "#a78bfa" : isHovered ? "#fff" : "rgba(255,255,255,0.3)";
  const strokeW = isSelected ? 3 : isHovered ? 2.5 : 1.5;
  const shadow = isSelected
    ? "filter:drop-shadow(0 0 12px rgba(139,92,246,0.9)) drop-shadow(0 0 4px rgba(139,92,246,0.5));"
    : isHovered
      ? "filter:drop-shadow(0 0 8px rgba(139,92,246,0.7));"
      : "filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));";

  // Red dot if no website
  const noSiteDot = !hasWebsite
    ? `<circle cx="22" cy="6" r="4" fill="#ef4444" stroke="#1a1a1f" stroke-width="1.5"/>`
    : "";

  return L.divIcon({
    className: "",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 4],
    html: `<svg width="${w}" height="${h}" viewBox="0 0 30 42" style="${shadow}transition:all 0.15s ease;cursor:pointer;">
      <path d="M15 41 C15 41 28 25 28 15 C28 7.3 22.2 1 15 1 C7.8 1 2 7.3 2 15 C2 25 15 41 15 41Z"
        fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>
      <text x="15" y="18" text-anchor="middle" dominant-baseline="central"
        fill="#fff" font-weight="800" font-size="${isSelected || isHovered ? 13 : 11}" font-family="system-ui,sans-serif">${rank}</text>
      ${noSiteDot}
    </svg>`,
  });
}

/* -- Recenter map -- */
function RecenterMap({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [map, center.lat, center.lng]);
  return null;
}

export default function MapView({ prospects, center, hoveredId, selectedId, onHover, onSelect }: Props) {
  const withCoords = prospects.filter((p) => p.lat != null && p.lng != null);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="h-full w-full"
      style={{ background: "#111114" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <RecenterMap center={center} />
      {withCoords.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat!, p.lng!]}
          icon={createPinIcon(p.rank, hoveredId === p.id, !!p.website, selectedId === p.id)}
          eventHandlers={{
            mouseover: () => onHover(p.id),
            mouseout: () => onHover(null),
            click: () => onSelect?.(p.id),
          }}
        />
      ))}
    </MapContainer>
  );
}
