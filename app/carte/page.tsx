"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Star,
  Globe,
  GlobeOff,
  Search,
  Trophy,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import type { MapProspect } from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

/* -- Geocode cache -- */
const geoCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeVille(ville: string): Promise<{ lat: number; lng: number } | null> {
  if (geoCache.has(ville)) return geoCache.get(ville)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ville + ", France")}&format=json&limit=1`,
      { headers: { "User-Agent": "ProspectsTracker/1.0" } },
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

/* -- GBP score (with website factor) -- */
function computeGbpScoreFull(
  rating: number | null,
  reviews: number | null,
  hasWebsite: boolean,
): number {
  const ratingScore = rating != null ? (rating / 5) * 40 : 0;
  const reviewsScore =
    reviews != null
      ? Math.min(Math.log10(reviews + 1) / Math.log10(500), 1) * 40
      : 0;
  const websiteScore = hasWebsite ? 20 : 0;
  return Math.round(ratingScore + reviewsScore + websiteScore);
}

/* -- Rank helpers -- */
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

/* -- Main -- */
export default function CartePage() {
  const [metier, setMetier] = useState("");
  const [ville, setVille] = useState("");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MapProspect[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState<"all" | "no-site" | "has-site">("all");
  const [searchDone, setSearchDone] = useState(false);

  const doSearch = useCallback(async () => {
    if (!metier.trim() || !ville.trim()) return;
    setLoading(true);
    setError(null);
    setSearchDone(false);

    try {
      const res = await fetch("/api/carte/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metier: metier.trim(), ville: ville.trim(), limit }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Erreur ${res.status}`);
        setLoading(false);
        return;
      }

      const json = await res.json();
      const competitors: Array<{
        name: string;
        rating: string;
        reviews: string;
        phone: string;
        address: string;
        website: string;
        maps_url: string;
        category: string;
      }> = json.competitors || [];

      // Score & rank
      const scored = competitors.map((c, i) => {
        const rating = c.rating ? parseFloat(c.rating.replace(",", ".")) : null;
        const reviews = c.reviews ? parseInt(c.reviews, 10) : null;
        const hasWebsite = !!c.website && c.website.length > 0;
        return {
          id: `search-${i}`,
          name: c.name,
          rating: rating && !isNaN(rating) ? rating : null,
          reviews: reviews && !isNaN(reviews) ? reviews : null,
          phone: c.phone || "",
          website: c.website || null,
          address: c.address || null,
          maps_url: c.maps_url || null,
          gbp_score: computeGbpScoreFull(
            rating && !isNaN(rating) ? rating : null,
            reviews && !isNaN(reviews) ? reviews : null,
            hasWebsite,
          ),
          rank: 0,
        };
      });

      scored.sort((a, b) => b.gbp_score - a.gbp_score);
      scored.forEach((p, i) => (p.rank = i + 1));

      // Geocode & spread markers
      const center = await geocodeVille(ville.trim());
      const withCoords: MapProspect[] = scored.map((p, i) => {
        if (center) {
          const angle = (2 * Math.PI * i) / Math.max(scored.length, 1);
          const radius = 0.004 + Math.random() * 0.007;
          return {
            ...p,
            lat: center.lat + Math.cos(angle) * radius,
            lng: center.lng + Math.sin(angle) * radius,
          };
        }
        return p;
      });

      setResults(withCoords);
      setSearchDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [metier, ville, limit]);

  // Filter displayed list
  const displayList = useMemo(() => {
    if (siteFilter === "all") return results;
    const filtered = results.filter((p) =>
      siteFilter === "no-site" ? !p.website : !!p.website,
    );
    return filtered.map((p, i) => ({ ...p, rank: i + 1 }));
  }, [results, siteFilter]);

  const mapCenter = useMemo(() => {
    const withCoords = displayList.filter((p) => p.lat && p.lng);
    if (withCoords.length === 0) return { lat: 46.5, lng: 2.5 };
    const avgLat = withCoords.reduce((s, p) => s + p.lat!, 0) / withCoords.length;
    const avgLng = withCoords.reduce((s, p) => s + p.lng!, 0) / withCoords.length;
    return { lat: avgLat, lng: avgLng };
  }, [displayList]);

  const noSiteCount = results.filter((p) => !p.website).length;
  const hasSiteCount = results.length - noSiteCount;

  return (
    <main className="h-screen flex flex-col bg-[var(--color-background)] text-neutral-100">
      {/* Top bar */}
      <div className="shrink-0 bg-[#111114] border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/"
            className="p-2 rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 text-neutral-400 hover:text-violet-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="shrink-0">
            <h1 className="font-display italic text-[22px] leading-none tracking-tight text-neutral-50">
              Carte <span className="text-violet-300">Explorer</span>
            </h1>
            <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">
              {searchDone
                ? `${displayList.length} résultats${siteFilter === "no-site" ? " sans site" : siteFilter === "has-site" ? " avec site" : ""} · ${ville}`
                : "Recherchez un métier + ville"}
            </p>
          </div>

          {/* Search form */}
          <form
            className="flex items-center gap-2 flex-1 min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              doSearch();
            }}
          >
            <div className="relative flex-1 min-w-0 max-w-[200px]">
              <input
                type="text"
                placeholder="Métier (ex: electricien)"
                value={metier}
                onChange={(e) => setMetier(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50 text-neutral-200 placeholder:text-neutral-600"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>
            <div className="relative flex-1 min-w-0 max-w-[240px]">
              <input
                type="text"
                placeholder="Ville (ex: Brissac Loire Aubance)"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50 text-neutral-200 placeholder:text-neutral-600"
              />
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>

            {/* Limit */}
            <div className="relative shrink-0">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="appearance-none pl-8 pr-7 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50 text-neutral-200 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
              <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>

            <button
              type="submit"
              disabled={loading || !metier.trim() || !ville.trim()}
              className="shrink-0 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? "Scraping..." : "Rechercher"}
            </button>
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-[360px] shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)]/30 flex flex-col overflow-hidden">
          {/* Sidebar header */}
          <div className="px-3 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-300">
                <Trophy className="w-4 h-4 text-amber-400" />
                Classement GBP
              </div>
              {searchDone && results.length > 0 && (
                <div className="flex items-center gap-1">
                  {([
                    { key: "all" as const, label: "Tous", count: results.length, icon: null },
                    { key: "no-site" as const, label: "Sans site", count: noSiteCount, icon: <GlobeOff className="w-3 h-3" /> },
                    { key: "has-site" as const, label: "Avec site", count: hasSiteCount, icon: <Globe className="w-3 h-3" /> },
                  ]).map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setSiteFilter(siteFilter === f.key ? "all" : f.key)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border transition ${
                        siteFilter === f.key
                          ? f.key === "no-site"
                            ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                            : f.key === "has-site"
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                              : "bg-violet-500/15 border-violet-500/40 text-violet-300"
                          : "bg-[var(--color-surface)] border-[var(--color-border)] text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      {f.icon}
                      {f.count}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5 ml-6">
              Score = note (40%) + avis (40%) + site web (20%)
            </div>
          </div>

          {/* Sidebar list */}
          <div className="flex-1 overflow-y-auto">
            {!searchDone && !loading && (
              <div className="py-16 text-center px-6">
                <Search className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                <div className="text-sm text-neutral-500">
                  Entrez un métier et une ville pour<br />lancer la recherche Google Maps
                </div>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                <div className="text-sm text-neutral-400">Scraping Google Maps...</div>
                <div className="text-[10px] text-neutral-600">Cela peut prendre 30-60s</div>
              </div>
            )}

            {error && (
              <div className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
                {error}
              </div>
            )}

            {searchDone && displayList.length === 0 && (
              <div className="py-12 text-center text-neutral-500 text-sm">
                {siteFilter === "no-site" ? "Tous ont un site web" : siteFilter === "has-site" ? "Aucun n'a de site web" : "Aucun résultat"}
              </div>
            )}

            <div className="divide-y divide-[var(--color-border)]">
              {displayList.map((p) => (
                <button
                  key={p.id}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-full text-left px-3 py-2.5 transition-colors ${
                    hoveredId === p.id
                      ? "bg-violet-500/10"
                      : "hover:bg-[var(--color-surface)]/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Rank badge */}
                    <div
                      className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${rankBg(p.rank)} ${rankText(p.rank)}`}
                    >
                      {p.rank}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-neutral-100 truncate">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.rating ? (
                          <span className="flex items-center gap-0.5 text-[11px] text-neutral-300">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {p.rating}
                            <span className="text-neutral-600">
                              ({p.reviews ?? 0})
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-neutral-600">
                            Pas de note
                          </span>
                        )}
                        {p.phone && (
                          <a
                            href={`tel:${p.phone.replace(/\s/g, "")}`}
                            className="text-[10px] text-neutral-500 font-mono hover:text-violet-300 transition"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {p.phone}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Score + website */}
                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                      <span
                        className={`text-[13px] font-mono font-bold ${
                          p.gbp_score >= 70
                            ? "text-emerald-300"
                            : p.gbp_score >= 40
                              ? "text-amber-300"
                              : "text-rose-300"
                        }`}
                      >
                        {p.gbp_score}
                      </span>
                      {p.website ? (
                        <Globe className="w-3 h-3 text-neutral-600" />
                      ) : (
                        <GlobeOff className="w-3 h-3 text-rose-400" />
                      )}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="mt-1.5 ml-9 h-1 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        p.gbp_score >= 70
                          ? "bg-emerald-500"
                          : p.gbp_score >= 40
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(p.gbp_score, 100)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 z-10 bg-[var(--color-background)]/80 flex items-center justify-center">
              <div className="flex items-center gap-3 text-neutral-300">
                <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                <span className="text-sm">Scraping en cours...</span>
              </div>
            </div>
          )}
          <MapView
            prospects={displayList}
            center={mapCenter}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
        </div>
      </div>
    </main>
  );
}
