"use client";

import { useState } from "react";
import {
  BarChart3,
  ChevronDown,
  Star,
  Globe,
  Loader2,
  RefreshCw,
  TrendingUp,
  MapPin,
  Trophy,
} from "lucide-react";
import type { CompetitorReport } from "../lib/types";

interface Props {
  prospectId: string;
  ville: string;
  metier: string;
  prospectName: string;
  prospectRating: number | null;
  prospectReviews: number | null;
}

const LIMITS = [5, 10, 20] as const;
type Limit = (typeof LIMITS)[number];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreColor(score: number): string {
  if (score >= 70) return "from-emerald-500 to-emerald-400";
  if (score >= 40) return "from-amber-500 to-amber-400";
  return "from-rose-500 to-rose-400";
}

function rankColor(rank: number): { text: string; bg: string; border: string } {
  if (rank <= 3) return { text: "text-emerald-200", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  if (rank <= 7) return { text: "text-amber-200", bg: "bg-amber-500/10", border: "border-amber-500/30" };
  return { text: "text-rose-200", bg: "bg-rose-500/10", border: "border-rose-500/30" };
}

export default function CompetitorSection({
  prospectId,
  ville,
  metier,
  prospectName,
  prospectRating,
  prospectReviews,
}: Props) {
  const [report, setReport] = useState<CompetitorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<Limit>(10);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/competitor/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, limit }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Erreur ${res.status}${body ? ` — ${body.slice(0, 120)}` : ""}`);
      }
      const data: CompetitorReport = await res.json();
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const reAnalyze = () => {
    setReport(null);
    setError(null);
    analyze();
  };

  // Find prospect position in competitors list
  const prospectScore = report
    ? (() => {
        const match = report.competitors.find(
          (c) => c.name.toLowerCase() === prospectName.toLowerCase()
        );
        if (match) return match.gbp_score;
        // Estimate from prospect data if not in list
        const ratingScore = (prospectRating ?? 0) * 12;
        const reviewScore = Math.min((prospectReviews ?? 0) * 0.3, 30);
        return Math.round(ratingScore + reviewScore);
      })()
    : 0;

  const prospectRank = report
    ? report.competitors.filter((c) => c.gbp_score > prospectScore).length + 1
    : 0;

  return (
    <details className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/40 group">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
        <span className="flex items-center gap-2 text-sm font-medium text-neutral-200">
          <BarChart3 className="w-4 h-4 text-violet-300" />
          Analyse concurrentielle
        </span>
        <ChevronDown className="w-4 h-4 text-neutral-500 group-open:rotate-180 transition" />
      </summary>
      <div className="px-4 pb-4">
        {/* No report, not loading — show controls */}
        {!report && !loading && !error && (
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              {LIMITS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLimit(l)}
                  className={`px-3 py-1.5 text-xs font-mono transition ${
                    limit === l
                      ? "bg-violet-500/20 text-violet-200 border-violet-500/40"
                      : "bg-[var(--color-surface)] text-neutral-400 hover:text-neutral-200"
                  } ${l !== LIMITS[0] ? "border-l border-[var(--color-border)]" : ""}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={analyze}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white font-medium text-sm transition shadow-lg shadow-violet-900/30"
            >
              <TrendingUp className="w-4 h-4" />
              Analyser la concurrence
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            <p className="text-sm text-neutral-400">
              Analyse en cours... (~15-30s)
            </p>
            <div className="w-32 h-1 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-pulse rounded-full" />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="space-y-3">
            <div className="px-3 py-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 text-[12px] text-rose-300 break-words">
              {error}
            </div>
            <button
              onClick={() => { setError(null); }}
              className="text-xs text-neutral-400 hover:text-violet-300 transition"
            >
              Retour
            </button>
          </div>
        )}

        {/* Report display */}
        {report && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-neutral-200">
                  Concurrents {"\u00E0"} {report.ville}
                </h4>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {formatDate(report.created_at)}
                </p>
              </div>
              <button
                onClick={reAnalyze}
                className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-violet-300 transition"
              >
                <RefreshCw className="w-3 h-3" />
                Relancer
              </button>
            </div>

            {/* Competitor list */}
            <div className="space-y-1.5">
              {report.competitors.map((c, i) => (
                <div
                  key={`${c.name}-${i}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--color-surface)]/60 border border-[var(--color-border)] text-[12px]"
                >
                  {/* Rank */}
                  <span className="shrink-0 w-5 text-right font-mono text-neutral-500">
                    #{i + 1}
                  </span>

                  {/* Name */}
                  <span className="flex-1 min-w-0 font-medium text-neutral-200 truncate">
                    {c.name}
                  </span>

                  {/* Rating */}
                  {c.rating != null && c.rating > 0 ? (
                    <span className="shrink-0 flex items-center gap-0.5 text-neutral-300">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="font-semibold">{c.rating}</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-neutral-600">--</span>
                  )}

                  {/* Reviews */}
                  <span className="shrink-0 w-12 text-right text-neutral-500">
                    {c.reviews ?? 0} avis
                  </span>

                  {/* Website badge */}
                  {c.website ? (
                    <span className="shrink-0 flex items-center gap-0.5 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                      <Globe className="w-2.5 h-2.5" />
                      Site
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800/60 text-neutral-500 border border-neutral-700">
                      Pas de site
                    </span>
                  )}

                  {/* GBP Score bar */}
                  <div className="shrink-0 flex items-center gap-1.5 w-24">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${scoreColor(c.gbp_score)}`}
                        style={{ width: `${Math.min(c.gbp_score, 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-neutral-400 w-5 text-right">
                      {c.gbp_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Prospect position card */}
            {(() => {
              const rc = rankColor(prospectRank);
              return (
                <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${rc.bg} border ${rc.border}`}>
                  <MapPin className={`w-4 h-4 shrink-0 ${rc.text}`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${rc.text}`}>
                      {prospectName}
                    </span>
                    <span className="text-[12px] text-neutral-400 ml-2">
                      score {prospectScore}/100 — rang #{prospectRank} sur {report.competitors.length}
                    </span>
                  </div>
                  {prospectRank <= 3 && (
                    <Trophy className="w-4 h-4 shrink-0 text-emerald-300" />
                  )}
                </div>
              );
            })()}

            {/* Ads budget card */}
            {report.ads_budget_est != null && (
              <div className="px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-violet-300" />
                  <span className="text-[12px] font-medium text-neutral-200">
                    Budget Google Ads estim{"\u00E9"}
                  </span>
                </div>
                <div className="text-lg font-bold text-neutral-100 font-mono">
                  {report.ads_budget_est}{"\u20AC"} <span className="text-sm font-normal text-neutral-500">/ mois</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
