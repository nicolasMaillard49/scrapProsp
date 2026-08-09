"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Phone,
  MessageCircle,
  ExternalLink,
  X,
  Copy,
  Check,
  Menu,
  UserPlus,
  CheckCircle,
} from "lucide-react";
import type { MapProspect } from "./MapView";
import { computeGbpScore } from "@/app/lib/gbp";
import { phoneForWhatsApp } from "@/app/lib/links";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-[#111114]">
      <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
    </div>
  ),
});

/* -- Geocodage via la Base Adresse Nationale (api-adresse.data.gouv.fr) --
   Gratuit, sans clé, optimisé France. Remplace Nominatim/OSM. */
type GeoHit = { lat: number; lng: number; score: number };
const geoCache = new Map<string, GeoHit | null>();

async function banGeocode(query: string, params = ""): Promise<GeoHit | null> {
  const q = query.trim();
  if (!q) return null;
  const cacheKey = params + "|" + q;
  if (geoCache.has(cacheKey)) return geoCache.get(cacheKey)!;
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1&autocomplete=0${params}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
      const hit: GeoHit = { lat: coords[1], lng: coords[0], score: f.properties?.score ?? 0 };
      geoCache.set(cacheKey, hit);
      return hit;
    }
  } catch {
    /* Don't cache failures -- allow retries on next search */
  }
  return null;
}

/* Centre-ville (fallback + recentrage de la carte) */
async function geocodeVille(ville: string): Promise<{ lat: number; lng: number } | null> {
  const hit = await banGeocode(ville, "&type=municipality");
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

/* Adresse précise d'un prospect — on rejette les matchs trop faibles */
async function geocodeAddress(address: string): Promise<GeoHit | null> {
  const hit = await banGeocode(address);
  return hit && hit.score >= 0.4 ? hit : null;
}

/* map() avec concurrence bornée (évite de saturer l'API en parallèle) */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      // Un échec isolé ne doit jamais casser le rendu de toute la carte.
      try {
        results[i] = await fn(items[i], i);
      } catch {
        results[i] = null as R;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

/* -- Rank helpers -- */
function rankBg(rank: number): string {
  if (rank === 1) return "bg-amber-100 border-amber-300 dark:bg-amber-500/15 dark:border-amber-500/40";
  if (rank <= 3) return "bg-emerald-100 border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30";
  return "bg-[var(--color-surface)]/60 border-[var(--color-border)]";
}
function rankText(rank: number): string {
  if (rank === 1) return "text-amber-700 dark:text-amber-300";
  if (rank <= 3) return "text-emerald-700 dark:text-emerald-300";
  return "text-[var(--color-text-secondary)]";
}

/* -- Detail helpers -- */
function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-[var(--color-surface)]/40 border border-[var(--color-border)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-text-muted)]">{icon}</span>
        <span className="text-sm text-[var(--color-text-primary)]">{value}</span>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  /* Default: sidebar closed on mobile */
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const doSearch = useCallback(async () => {
    if (!metier.trim() || !ville.trim()) return;
    setLoading(true);
    setError(null);
    setSearchDone(false);
    setSelectedId(null);

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
        const rawSite = c.website && /^https?:\/\/.+\..+/.test(c.website) ? c.website : null;
        const hasWebsite = !!rawSite;
        return {
          id: `search-${i}`,
          name: c.name,
          rating: rating && !isNaN(rating) ? rating : null,
          reviews: reviews && !isNaN(reviews) ? reviews : null,
          phone: c.phone || "",
          website: rawSite,
          address: c.address || null,
          maps_url: c.maps_url || null,
          gbp_score: computeGbpScore(
            rating && !isNaN(rating) ? rating : null,
            reviews && !isNaN(reviews) ? reviews : null,
            hasWebsite,
          ),
          rank: 0,
        };
      });

      scored.sort((a, b) => b.gbp_score - a.gbp_score);
      scored.forEach((p, i) => (p.rank = i + 1));

      // Geocode : vraie adresse (BAN) en priorité, sinon dispersion autour du centre-ville
      const center = await geocodeVille(ville.trim());
      const geoHits = await mapWithConcurrency(scored, 6, (p) =>
        p.address ? geocodeAddress(p.address) : Promise.resolve(null),
      );

      const withCoords: MapProspect[] = scored.map((p, i) => {
        const hit = geoHits[i];
        if (hit) {
          return { ...p, lat: hit.lat, lng: hit.lng, precise: true };
        }
        if (center) {
          // Dispersion déterministe en cercle (positions approximatives)
          const angle = (2 * Math.PI * i) / Math.max(scored.length, 1);
          const radius = 0.004 + ((i * 37) % 100) / 100 * 0.007;
          return {
            ...p,
            lat: center.lat + Math.cos(angle) * radius,
            lng: center.lng + Math.sin(angle) * radius,
            precise: false,
          };
        }
        return { ...p, precise: false };
      });

      setResults(withCoords);
      setSearchDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [metier, ville, limit]);

  const handleAddProspect = useCallback(async (prospect: MapProspect) => {
    if (addingId || addedIds.has(prospect.id)) return;
    setAddingId(prospect.id);

    try {
      const res = await fetch("/api/carte/add-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prospect.name,
          metier: metier.trim(),
          ville: ville.trim(),
          rating: prospect.rating,
          reviews: prospect.reviews,
          website: prospect.website || null,
          maps_url: prospect.maps_url || "",
        }),
      });

      const json = await res.json();

      if (res.status === 409) {
        // Already exists
        setAddedIds((prev) => new Set(prev).add(prospect.id));
      } else if (!res.ok) {
        setError(json.error || "Erreur lors de l'ajout");
      } else {
        setAddedIds((prev) => new Set(prev).add(prospect.id));
        // Update phone/address in local results if enriched
        if (json.prospect) {
          setResults((prev) =>
            prev.map((p) =>
              p.id === prospect.id
                ? {
                    ...p,
                    phone: json.prospect.phone || p.phone,
                    address: json.prospect.address || p.address,
                  }
                : p,
            ),
          );
        }
      }
    } catch {
      setError("Erreur réseau lors de l'ajout");
    } finally {
      setAddingId(null);
    }
  }, [addingId, addedIds, metier, ville]);

  // Filter displayed list -- keep original ranks
  const displayList = useMemo(() => {
    if (siteFilter === "all") return results;
    return results.filter((p) =>
      siteFilter === "no-site" ? !p.website : !!p.website,
    );
  }, [results, siteFilter]);

  const selectedProspect = useMemo(
    () => displayList.find((p) => p.id === selectedId) ?? null,
    [selectedId, displayList],
  );

  const mapCenter = useMemo(() => {
    const withCoords = displayList.filter((p) => p.lat && p.lng);
    if (withCoords.length === 0) return { lat: 46.5, lng: 2.5 };
    const avgLat = withCoords.reduce((s, p) => s + p.lat!, 0) / withCoords.length;
    const avgLng = withCoords.reduce((s, p) => s + p.lng!, 0) / withCoords.length;
    return { lat: avgLat, lng: avgLng };
  }, [displayList]);

  const noSiteCount = results.filter((p) => !p.website).length;
  const hasSiteCount = results.length - noSiteCount;
  const approxCount = displayList.filter((p) => p.lat != null && !p.precise).length;

  return (
    <main className="h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-text-primary)]">
      {/* Top bar */}
      <div className="shrink-0 bg-[#111114] border-b border-[var(--color-border)] px-3 md:px-4 py-3">
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <Link
            href="/"
            className="p-2 rounded-lg border border-[var(--color-border)] hover:border-violet-300 dark:hover:border-violet-500/50 text-[var(--color-text-secondary)] hover:text-violet-700 dark:hover:text-violet-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg border border-[var(--color-border)] hover:border-violet-300 dark:hover:border-violet-500/50 text-[var(--color-text-secondary)] hover:text-violet-700 dark:hover:text-violet-300 transition"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="shrink-0">
            <h1 className="font-display text-[22px] leading-none tracking-tight text-[var(--color-text-primary)]">
              Carte <span className="text-violet-700 dark:text-violet-300">Explorer</span>
            </h1>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 font-mono">
              {searchDone
                ? `${displayList.length} résultats${siteFilter === "no-site" ? " sans site" : siteFilter === "has-site" ? " avec site" : ""} · ${ville}`
                : "Recherchez un métier + ville"}
            </p>
          </div>

          {/* Search form */}
          <form
            className="flex items-center gap-2 flex-1 min-w-0 flex-wrap md:flex-nowrap"
            onSubmit={(e) => {
              e.preventDefault();
              doSearch();
            }}
          >
            <div className="relative flex-1 min-w-[120px] max-w-full md:max-w-[200px]">
              <input
                type="text"
                placeholder="Métier (ex: electricien)"
                value={metier}
                onChange={(e) => setMetier(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-300 dark:focus:border-violet-500/50 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
            </div>
            <div className="relative flex-1 min-w-[120px] max-w-full md:max-w-[240px]">
              <input
                type="text"
                placeholder="Ville (ex: Brissac Loire Aubance)"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-300 dark:focus:border-violet-500/50 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              />
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
            </div>

            {/* Limit */}
            <div className="relative shrink-0">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="appearance-none pl-8 pr-7 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-300 dark:focus:border-violet-500/50 text-[var(--color-text-primary)] cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
              <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
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
              <span className="hidden sm:inline">{loading ? "Scraping..." : "Rechercher"}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left sidebar */}
        <div
          className={`fixed inset-0 z-30 md:relative md:z-auto w-full md:w-[360px] md:shrink-0 border-r border-[var(--color-border)] bg-[#111114] md:bg-[var(--color-surface)]/30 flex flex-col overflow-hidden transition-transform duration-200 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          {/* Sidebar header */}
          <div className="px-3 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--color-text-secondary)]">
                <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Classement GBP
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden ml-2 p-1 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition"
                >
                  <X className="w-4 h-4" />
                </button>
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
                            ? "bg-rose-100 border-rose-300 text-rose-700 dark:bg-rose-500/15 dark:border-rose-500/40 dark:text-rose-300"
                            : f.key === "has-site"
                              ? "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/40 dark:text-emerald-300"
                              : "bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-500/15 dark:border-violet-500/40 dark:text-violet-300"
                          : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {f.icon}
                      {f.count}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 ml-6">
              Score = note (40%) + avis (40%) + site web (20%)
            </div>
          </div>

          {/* Sidebar list */}
          <div className="flex-1 overflow-y-auto">
            {!searchDone && !loading && (
              <div className="py-16 text-center px-6">
                <Search className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
                <div className="text-sm text-[var(--color-text-muted)]">
                  Entrez un métier et une ville pour<br />lancer la recherche Google Maps
                </div>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-6 h-6 text-violet-600 dark:text-violet-400 animate-spin" />
                <div className="text-sm text-[var(--color-text-secondary)]">Scraping Google Maps...</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Cela peut prendre 30-60s</div>
              </div>
            )}

            {error && (
              <div className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300 text-sm">
                {error}
              </div>
            )}

            {searchDone && displayList.length === 0 && (
              <div className="py-12 text-center text-[var(--color-text-muted)] text-sm">
                {siteFilter === "no-site" ? "Tous ont un site web" : siteFilter === "has-site" ? "Aucun n'a de site web" : "Aucun résultat"}
              </div>
            )}

            <div className="divide-y divide-[var(--color-border)]">
              {displayList.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedId(selectedId === p.id ? null : p.id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-full text-left px-3 py-2.5 transition-colors ${
                    selectedId === p.id
                      ? "bg-violet-100 dark:bg-violet-500/15 border-l-2 border-l-violet-500"
                      : hoveredId === p.id
                        ? "bg-violet-100 dark:bg-violet-500/10"
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
                      <div className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.rating ? (
                          <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-text-secondary)]">
                            <Star className="w-3 h-3 text-amber-600 dark:text-amber-400 fill-amber-400" />
                            {p.rating}
                            <span className="text-[var(--color-text-muted)]">
                              ({p.reviews ?? 0})
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            Pas de note
                          </span>
                        )}
                        {p.phone && (
                          <a
                            href={`tel:${p.phone.replace(/\s/g, "")}`}
                            className="text-[10px] text-[var(--color-text-muted)] font-mono hover:text-violet-700 dark:hover:text-violet-300 transition"
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
                            ? "text-emerald-700 dark:text-emerald-300"
                            : p.gbp_score >= 40
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {p.gbp_score}
                      </span>
                      {p.website ? (
                        <Globe className="w-3 h-3 text-[var(--color-text-muted)]" />
                      ) : (
                        <GlobeOff className="w-3 h-3 text-rose-600 dark:text-rose-400" />
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
          <div className="absolute inset-0" style={{ zIndex: 0 }}>
            {loading && (
              <div className="absolute inset-0 bg-[var(--color-background)]/80 flex items-center justify-center" style={{ zIndex: 1 }}>
                <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-600 dark:text-violet-400" />
                  <span className="text-sm">Scraping en cours...</span>
                </div>
              </div>
            )}
            <MapView
              prospects={displayList}
              center={mapCenter}
              hoveredId={hoveredId}
              selectedId={selectedId}
              onHover={setHoveredId}
              onSelect={(id) => setSelectedId(id)}
            />
          </div>

          {/* Positions disclaimer (BAN) */}
          {searchDone && displayList.length > 0 && (
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-[#111114]/80 border border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] backdrop-blur-sm" style={{ zIndex: 1 }}>
              {approxCount === 0
                ? "Positions géocodées · BAN"
                : `${approxCount} approximative${approxCount > 1 ? "s" : ""} · BAN`}
            </div>
          )}

          {/* Detail panel */}
          {selectedProspect && (
            <div className="absolute inset-x-0 bottom-0 max-h-[70vh] md:inset-x-auto md:top-3 md:right-3 md:bottom-3 md:max-h-none md:w-[340px] bg-[#111114]/95 backdrop-blur-xl border border-[var(--color-border)] rounded-t-2xl md:rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden" style={{ zIndex: 1 }}>
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-[var(--color-border)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border ${rankBg(selectedProspect.rank)} ${rankText(selectedProspect.rank)}`}
                    >
                      {selectedProspect.rank}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                        {selectedProspect.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {selectedProspect.rating ? (
                          <span className="flex items-center gap-0.5 text-xs text-[var(--color-text-secondary)]">
                            <Star className="w-3 h-3 text-amber-600 dark:text-amber-400 fill-amber-400" />
                            {selectedProspect.rating}
                            <span className="text-[var(--color-text-muted)]">({selectedProspect.reviews ?? 0})</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">Pas de note</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* Score */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--color-surface)]/60 border border-[var(--color-border)]">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium">Score GBP</span>
                  <span
                    className={`text-lg font-mono font-bold ${
                      selectedProspect.gbp_score >= 70
                        ? "text-emerald-700 dark:text-emerald-300"
                        : selectedProspect.gbp_score >= 40
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {selectedProspect.gbp_score}/100
                  </span>
                </div>

                {/* Website status */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                  selectedProspect.website
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/8 dark:border-emerald-500/25"
                    : "bg-rose-50 border-rose-200 dark:bg-rose-500/8 dark:border-rose-500/25"
                }`}>
                  {selectedProspect.website ? (
                    <>
                      <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium truncate flex-1">
                        {selectedProspect.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                      </span>
                      <a
                        href={selectedProspect.website.match(/^https?:\/\//) ? selectedProspect.website : `https://${selectedProspect.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 rounded transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </a>
                    </>
                  ) : (
                    <>
                      <GlobeOff className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span className="text-xs text-rose-700 dark:text-rose-300 font-medium">Pas de site web -- Prospect idéal</span>
                    </>
                  )}
                </div>

                {/* Address */}
                {selectedProspect.address && (
                  <DetailRow
                    icon={<MapPin className="w-4 h-4" />}
                    label="Adresse"
                    value={selectedProspect.address}
                  />
                )}

                {/* Phone */}
                {selectedProspect.phone && (
                  <div className="px-3 py-2 rounded-xl bg-[var(--color-surface)]/40 border border-[var(--color-border)]">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium mb-1">Téléphone</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-primary)] font-mono">{selectedProspect.phone}</span>
                      <CopyButton text={selectedProspect.phone} />
                    </div>
                  </div>
                )}

                {/* Maps link */}
                {selectedProspect.maps_url && (
                  <a
                    href={selectedProspect.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-surface)]/40 border border-[var(--color-border)] hover:border-violet-300 dark:hover:border-violet-500/40 transition group"
                  >
                    <MapPin className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-violet-600 dark:group-hover:text-violet-400 transition" />
                    <span className="text-xs text-[var(--color-text-secondary)] group-hover:text-violet-700 dark:group-hover:text-violet-300 transition">Voir sur Google Maps</span>
                    <ExternalLink className="w-3 h-3 text-[var(--color-text-muted)] ml-auto group-hover:text-violet-600 dark:group-hover:text-violet-400 transition" />
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="px-4 py-3 border-t border-[var(--color-border)] space-y-2">
                {/* Add to prospects */}
                <button
                  onClick={() => handleAddProspect(selectedProspect)}
                  disabled={addingId === selectedProspect.id || addedIds.has(selectedProspect.id)}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    addedIds.has(selectedProspect.id)
                      ? "bg-emerald-100 border border-emerald-300 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300 cursor-default"
                      : addingId === selectedProspect.id
                        ? "bg-violet-600/50 text-white/60 cursor-wait"
                        : "bg-violet-600 hover:bg-violet-500 text-white"
                  }`}
                >
                  {addedIds.has(selectedProspect.id) ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Ajouté à ma liste
                    </>
                  ) : addingId === selectedProspect.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enrichissement...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Ajouter aux prospects
                    </>
                  )}
                </button>

                {selectedProspect.phone && (
                  <div className="flex gap-2">
                    <a
                      href={`tel:${selectedProspect.phone.replace(/\s/g, "")}`}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-violet-300 dark:hover:border-violet-500/50 text-[var(--color-text-primary)] hover:text-violet-700 dark:hover:text-violet-300 text-sm font-medium transition"
                    >
                      <Phone className="w-4 h-4" />
                      Appeler
                    </a>
                    <a
                      href={`https://wa.me/${phoneForWhatsApp(selectedProspect.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-emerald-300 dark:hover:border-emerald-500/50 text-[var(--color-text-primary)] hover:text-emerald-700 dark:hover:text-emerald-300 text-sm font-medium transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
