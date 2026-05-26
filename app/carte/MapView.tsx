"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapProspect {
  id: string;
  name: string;
  rank: number;
  gbp_score: number;
  rating: number | null;
  reviews: number | null;
  phone: string;
  lat?: number;
  lng?: number;
}

interface Props {
  prospects: MapProspect[];
  center: { lat: number; lng: number };
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

/* ── Custom marker icon per rank ── */
function createIcon(rank: number, isHovered: boolean): L.DivIcon {
  const size = isHovered ? 36 : 28;
  const bg =
    rank === 1
      ? "#f59e0b"
      : rank <= 3
        ? "#10b981"
        : rank <= 7
          ? "#8b5cf6"
          : "#6b7280";
  const border = isHovered ? "3px solid #fff" : "2px solid rgba(255,255,255,0.3)";
  const shadow = isHovered ? "0 0 12px rgba(139,92,246,0.6)" : "0 2px 6px rgba(0,0,0,0.4)";

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${bg};
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:${isHovered ? 14 : 12}px;
      border:${border};
      box-shadow:${shadow};
      transition:all 0.15s ease;
      cursor:pointer;
    ">${rank}</div>`,
  });
}

/* ── Recenter the map when center changes ── */
function RecenterMap({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], 13, { animate: true });
  }, [map, center.lat, center.lng]);
  return null;
}

export default function MapView({ prospects, center, hoveredId, onHover }: Props) {
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
          icon={createIcon(p.rank, hoveredId === p.id)}
          eventHandlers={{
            mouseover: () => onHover(p.id),
            mouseout: () => onHover(null),
          }}
        >
          <Popup>
            <div style={{
              background: "#1a1a1f",
              color: "#e5e5e5",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid #2a2a30",
              minWidth: "180px",
              fontFamily: "system-ui, sans-serif",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <div style={{
                  width: "24px", height: "24px", borderRadius: "50%",
                  background: p.rank <= 3 ? "#10b981" : "#8b5cf6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: "11px",
                }}>
                  {p.rank}
                </div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>{p.name}</div>
              </div>
              {p.rating && (
                <div style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "4px" }}>
                  {"⭐"} {p.rating} ({p.reviews ?? 0} avis)
                </div>
              )}
              <div style={{ fontSize: "12px", color: "#a0a0a0", marginBottom: "4px" }}>
                Score GBP: <span style={{ color: p.gbp_score >= 70 ? "#10b981" : p.gbp_score >= 40 ? "#f59e0b" : "#ef4444", fontWeight: 700 }}>{p.gbp_score}/100</span>
              </div>
              {p.phone && (
                <a href={`tel:${p.phone.replace(/\s/g, "")}`} style={{ fontSize: "12px", color: "#8b5cf6", textDecoration: "none" }}>
                  {p.phone}
                </a>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
