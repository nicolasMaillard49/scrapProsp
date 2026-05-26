"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Star,
  Globe,
  Search,
  Trophy,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { computeGbpScore } from "../lib/gbp";
import type { Prospect } from "../lib/types";

/* ── Lazy-load the map component (Leaflet needs window) ── */
const MapView = dynamic(() => import("./MapView"), { ssr: false });

/* ── Types ── */
interface RankedProspect extends Prospect {
  gbp_score: number;
  rank: number;
  lat?: number;
  lng?: number;
}

/* ── Geocode cache ── */
const geoCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeVille(ville: string): Promise<{ lat: number; lng: number } | null> {
  if (geoCache.has(ville)) return geoCache.get(ville)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ville + ", France")}&format=json&limit=1`,
      { headers: { "User-Agent": "ProspectsTracker/1.0" } }
    );
    const data = await res.json();
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geoCache.set(ville, result);
      return result;
    }
  } catch {}
  geoCache.set(ville, null);
  return null;
}

/* ── Rank colors ── */
function rankBg(rank: number): string {
  if (rank === 1) return "bg-amber-500/15 border-amber-500/40";
  if (rank <= 3) return "bg-emerald-500/10 border-emerald-500/30";
  return "bg-[var(--color-surface)]/60 border-[var(--color-border)]";
}
function rankText(rank: number): string {
  if (rank === 1) return "text-amber-300";
  if (rank <= 3) return "text-emerald-300";
  return "text-neutral-400";
}

/* ── Main page component ── */
export default function CartePage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedVille, setSelectedVille] = useState<string>("");
  const [selectedMetier, setSelectedMetier] = useState<string>("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [rankedList, setRankedList] = useState<RankedProspect[]>([]);

  // Fetch all prospects
  useEffect(() => {
    if (!supabaseConfigured) { setLoaded(true); return; }
    supabase
      .from("prospects")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setProspects(data ?? []);
        setLoaded(true);
      });
  }, []);

  // Unique villes and metiers
  const villes = useMemo(
    () => [...new Set(prospects.map((p) => p.ville).filter(Boolean))].sort(),
    [prospects]
  );
  const metiers = useMemo(
    () => [...new Set(prospects.map((p) => p.metier).filter(Boolean))].sort(),
    [prospects]
  );

  // Auto-select first ville/metier
  useEffect(() => {
    if (!selectedVille && villes.length > 0) setSelectedVille(villes[0]);
    if (!selectedMetier && metiers.length > 0) setSelectedMetier(metiers[0]);
  }, [villes, metiers, selectedVille, selectedMetier]);

  // Filter, score, rank, geocode
  useEffect(() => {
    if (!selectedVille || !selectedMetier) return;
    const filtered = prospects.filter(
      (p) => p.ville === selectedVille && p.metier === selectedMetier
    );

    // Score and rank
    const scored = filtered.map((p) => ({
      ...p,
      gbp_score: computeGbpScore(p.rating, p.reviews),
      rank: 0,
    }));
    scored.sort((a, b) => b.gbp_score - a.gbp_score);
    scored.forEach((p, i) => (p.rank = i + 1));

    // Geocode
    setGeocoding(true);
    geocodeVille(selectedVille).then((center) => {
      const withCoords: RankedProspect[] = scored.map((p, i) => {
        if (center) {
          // Spread markers in a circle around the city center
          const angle = (2 * Math.PI * i) / Math.max(scored.length, 1);
          const radius = 0.005 + Math.random() * 0.008;
          return {
            ...p,
            lat: center.lat + Math.cos(angle) * radius,
            lng: center.lng + Math.sin(angle) * radius,
          };
        }
        return p;
      });
      setRankedList(withCoords);
      setGeocoding(false);
    });
  }, [selectedVille, selectedMetier, prospects]);

  const mapCenter = useMemo(() => {
    const withCoords = rankedList.filter((p) => p.lat && p.lng);
    if (withCoords.length === 0) return { lat: 46.5, lng: 2.5 }; // France center
    const avgLat = withCoords.reduce((s, p) => s + p.lat!, 0) / withCoords.length;
    const avgLng = withCoords.reduce((s, p) => s + p.lng!, 0) / withCoords.length;
    return { lat: avgLat, lng: avgLng };
  }, [rankedList]);

  return (
    <main className="h-screen flex flex-col bg-[var(--color-background)] text-neutral-100">
      {/* Top bar */}
      <div className="shrink-0 bg-[#111114] border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 text-neutral-400 hover:text-violet-300 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-display italic text-[22px] leading-none tracking-tight text-neutral-50">
                Carte <span className="text-violet-300">Prospects</span>
              </h1>
              <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                {rankedList.length} prospects {selectedVille && `· ${selectedVille}`}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedVille}
                onChange={(e) => setSelectedVille(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50 text-neutral-200 cursor-pointer"
              >
                {villes.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={selectedMetier}
                onChange={(e) => setSelectedMetier(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50 text-neutral-200 cursor-pointer"
              >
                {metiers.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Content: sidebar + map */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — ranking */}
        <div className="w-[340px] shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)]/30 overflow-y-auto">
          <div className="px-3 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/60">
            <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-300">
              <Trophy className="w-4 h-4 text-amber-400" />
              Classement GBP — {selectedVille}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5 ml-6">
              Score = note (40%) + avis (40%) + site web (20%)
            </div>
          </div>

          {!loaded && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            </div>
          )}

          {loaded && rankedList.length === 0 && (
            <div className="py-12 text-center text-neutral-500 text-sm">
              Aucun prospect pour cette sélection
            </div>
          )}

          <div className="divide-y divide-[var(--color-border)]">
            {rankedList.map((p) => (
              <button
                key={p.id}
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`w-full text-left px-3 py-2.5 transition-colors ${
                  hoveredId === p.id ? "bg-violet-500/10" : "hover:bg-[var(--color-surface)]/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {/* Rank badge */}
                  <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${rankBg(p.rank)} ${rankText(p.rank)}`}>
                    {p.rank}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-neutral-100 truncate">{p.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.rating ? (
                        <span className="flex items-center gap-0.5 text-[11px] text-neutral-300">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          {p.rating}
                          <span className="text-neutral-600">({p.reviews ?? 0})</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-600">Pas de note</span>
                      )}
                      {p.phone && (
                        <span className="text-[10px] text-neutral-500 font-mono">{p.phone}</span>
                      )}
                    </div>
                  </div>

                  {/* Score + website badge */}
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className={`text-[13px] font-mono font-bold ${
                      p.gbp_score >= 70 ? "text-emerald-300" :
                      p.gbp_score >= 40 ? "text-amber-300" : "text-rose-300"
                    }`}>
                      {p.gbp_score}
                    </span>
                    {p.maps_url && !p.maps_url.includes("undefined") ? (
                      <Globe className="w-3 h-3 text-neutral-600" />
                    ) : null}
                  </div>
                </div>

                {/* Score bar */}
                <div className="mt-1.5 ml-9 h-1 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      p.gbp_score >= 70 ? "bg-emerald-500" :
                      p.gbp_score >= 40 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.min(p.gbp_score, 100)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {geocoding && (
            <div className="absolute inset-0 z-10 bg-[var(--color-background)]/80 flex items-center justify-center">
              <div className="flex items-center gap-3 text-neutral-300">
                <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                <span className="text-sm">Chargement de la carte...</span>
              </div>
            </div>
          )}
          <MapView
            prospects={rankedList}
            center={mapCenter}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
        </div>
      </div>
    </main>
  );
}
