"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Star,
  Globe,
  Loader2,
  RefreshCw,
  TrendingUp,
  MapPin,
  Trophy,
  ExternalLink,
  FileDown,
  Copy,
  Check,
  MessageSquareQuote,
  Receipt,
} from "lucide-react";
import type { CompetitorReport } from "../lib/types";
import { generateSalesArgs } from "../lib/gbp";
import { generateProspectReport } from "../lib/generateReport";
import { whatsAppUrl, salesWhatsAppMsg } from "../lib/links";
import { estimateLeadsPerTier } from "../lib/competitor-config";

interface Props {
  prospectId: string;
  ville: string;
  metier: string;
  prospectName: string;
  prospectPhone: string;
  prospectRating: number | null;
  prospectReviews: number | null;
  onExpandChange?: (expanded: boolean) => void;
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
  prospectPhone,
  prospectRating,
  prospectReviews,
  onExpandChange,
}: Props) {
  const [report, setReport] = useState<CompetitorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<Limit>(10);

  const isExpanded = !!(report || loading);

  useEffect(() => {
    onExpandChange?.(isExpanded);
  }, [isExpanded, onExpandChange]);

  const analyze = async (force = false) => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/competitor/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, limit, force }),
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
    analyze(true);
  };

  // Compute prospect score using same formula as API
  const prospectScore = report
    ? (() => {
        const match = report.competitors.find(
          (c) => c.name.toLowerCase() === prospectName.toLowerCase()
        );
        if (match) return match.gbp_score;
        const ratingScore = prospectRating != null ? (prospectRating / 5) * 40 : 0;
        const reviewScore = prospectReviews != null
          ? Math.min(Math.log10(prospectReviews + 1) / Math.log10(500), 1) * 40
          : 0;
        // Prospect has no website (that's why they're a prospect)
        return Math.round(ratingScore + reviewScore);
      })()
    : 0;

  // Build merged list: competitors + prospect, sorted by score
  const rankedList = report
    ? (() => {
        const isInList = report.competitors.some(
          (c) => c.name.toLowerCase() === prospectName.toLowerCase()
        );
        type RankedItem = { name: string; rating: number | null; reviews: number | null; website: string | null; gbp_score: number; isProspect: boolean };
        const items: RankedItem[] = report.competitors.map((c) => ({ ...c, isProspect: false }));
        if (!isInList) {
          items.push({
            name: prospectName,
            rating: prospectRating,
            reviews: prospectReviews,
            website: null,
            gbp_score: prospectScore,
            isProspect: true,
          });
        } else {
          const idx = items.findIndex((c) => c.name.toLowerCase() === prospectName.toLowerCase());
          if (idx >= 0) items[idx].isProspect = true;
        }
        items.sort((a, b) => b.gbp_score - a.gbp_score);
        return items;
      })()
    : [];

  // Collapsed: show button inside the modal area
  if (!isExpanded && !error) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl p-5 w-full max-w-xs shadow-2xl flex flex-col items-center justify-center gap-4">
        <BarChart3 className="w-8 h-8 text-violet-300" />
        <h3 className="text-sm font-medium text-neutral-200 text-center">Analyse concurrentielle</h3>
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          {LIMITS.map((l) => (
            <button
              key={l}
              onClick={() => setLimit(l)}
              className={`px-3 py-1.5 text-xs font-mono transition ${
                limit === l
                  ? "bg-violet-500/20 text-violet-200"
                  : "bg-[var(--color-surface)] text-neutral-400 hover:text-neutral-200"
              } ${l !== LIMITS[0] ? "border-l border-[var(--color-border)]" : ""}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={() => analyze()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white font-medium text-sm transition shadow-lg shadow-violet-900/30"
        >
          <TrendingUp className="w-4 h-4" />
          Analyser
        </button>
      </div>
    );
  }

  // Expanded: side panel with results
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl p-5 w-full min-w-[340px] max-w-lg shadow-2xl overflow-y-auto max-h-[85vh]">
      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <p className="text-sm text-neutral-400">Analyse en cours... (~15-30s)</p>
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
            onClick={() => { setError(null); setReport(null); }}
            className="text-xs text-neutral-400 hover:text-violet-300 transition"
          >
            Retour
          </button>
        </div>
      )}

      {/* Report display */}
      {report && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-300" />
                Concurrents {"\u00E0"} {report.ville}
              </h3>
              <p className="text-[11px] text-neutral-500 mt-0.5 ml-6">
                {formatDate(report.created_at)} · {rankedList.length} r{"\u00E9"}sultats
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

          {/* Score legend */}
          <div className="text-[10px] text-neutral-500 px-1">
            Score = note (40%) + avis (40%) + site web (20%)
          </div>

          {/* Ranked list */}
          <div className="space-y-1">
            {rankedList.map((c, i) => {
              const rc = c.isProspect ? rankColor(i + 1) : null;
              const mapsUrl = !c.isProspect && "maps_url" in c ? (c as Record<string, unknown>).maps_url as string : null;
              return (
                <div
                  key={`${c.name}-${i}`}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] ${
                    c.isProspect
                      ? `${rc!.bg} border-2 ${rc!.border}`
                      : "bg-[var(--color-surface)]/60 border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition"
                  }`}
                >
                  {/* Rank */}
                  <span className={`shrink-0 w-5 text-right font-mono ${c.isProspect ? rc!.text + " font-bold" : "text-neutral-500"}`}>
                    #{i + 1}
                  </span>

                  {/* Prospect marker */}
                  {c.isProspect && <MapPin className={`w-3 h-3 shrink-0 ${rc!.text}`} />}

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <span className={`font-medium truncate block ${c.isProspect ? rc!.text : "text-neutral-200"}`}>
                      {c.name}
                      {c.isProspect && <span className="text-[10px] ml-1 opacity-70">(vous)</span>}
                    </span>
                  </div>

                  {/* Rating */}
                  {c.rating != null && c.rating > 0 ? (
                    <span className="shrink-0 flex items-center gap-0.5 text-neutral-300">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="font-semibold">{c.rating}</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-neutral-600 text-[11px]">--</span>
                  )}

                  {/* Reviews */}
                  <span className="shrink-0 text-right text-neutral-500 tabular-nums">
                    {c.reviews ?? 0}
                  </span>

                  {/* Website badge */}
                  {c.website ? (
                    <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-200">
                      <Globe className="w-2.5 h-2.5 inline" />
                    </span>
                  ) : (
                    <span className="shrink-0 w-4" />
                  )}

                  {/* Score bar */}
                  <div className="shrink-0 flex items-center gap-1 w-16">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${scoreColor(c.gbp_score)}`}
                        style={{ width: `${Math.min(c.gbp_score, 100)}%` }}
                      />
                    </div>
                    <span className={`font-mono text-[10px] w-5 text-right ${c.isProspect ? rc!.text : "text-neutral-400"}`}>
                      {c.gbp_score}
                    </span>
                  </div>

                  {/* Maps link for competitors */}
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-violet-300 hover:text-violet-200 transition"
                      title="Voir sur Google Maps"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : !c.isProspect ? (
                    <span className="shrink-0 w-3" />
                  ) : null}

                  {/* Trophy for top 3 prospects */}
                  {c.isProspect && i < 3 && (
                    <Trophy className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Site vitrine offer */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]/60">
              <Globe className="w-3.5 h-3.5 text-violet-300" />
              <span className="text-[12px] font-medium text-neutral-200">Site vitrine professionnel</span>
            </div>
            <div className="px-3 py-3 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold font-mono text-neutral-100">299{"\u20AC"}</span>
                  <span className="text-[10px] text-neutral-500">création unique</span>
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">Responsive, SEO, formulaire contact, Google Maps</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-[14px] font-bold font-mono text-violet-300">29{"\u20AC"}</span>
                  <span className="text-[10px] text-neutral-500">/mois</span>
                </div>
                <div className="text-[9px] text-neutral-500">maintenance & hébergement</div>
              </div>
            </div>
          </div>

          {/* Ads tiers + leads estimation */}
          {(report.ads_tiers ?? []).length > 0 ? (() => {
            const leadsData = estimateLeadsPerTier(metier);
            return (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 px-1">
                  <TrendingUp className="w-3.5 h-3.5 text-violet-300" />
                  <span className="text-[12px] font-medium text-neutral-200">
                    Forfaits Google Ads
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {report.ads_tiers!.map((tier) => {
                    const isTop = tier.key === "top1";
                    const isMid = tier.key === "performance";
                    const ld = leadsData.find((l) => l.key === tier.key);
                    return (
                      <div
                        key={tier.key}
                        className={`relative rounded-lg px-2.5 py-3 text-center border ${
                          isTop
                            ? "border-violet-500/50 bg-violet-500/10"
                            : isMid
                              ? "border-amber-500/30 bg-amber-500/5"
                              : "border-[var(--color-border)] bg-[var(--color-surface)]/40"
                        }`}
                      >
                        {isTop && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-violet-500 text-[9px] font-bold text-white uppercase tracking-wider">
                            Populaire
                          </div>
                        )}
                        <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                          isTop ? "text-violet-300" : isMid ? "text-amber-300" : "text-neutral-400"
                        }`}>
                          {tier.label}
                        </div>
                        <div className="text-lg font-bold text-neutral-100 font-mono leading-tight">
                          {tier.budget}{"\u20AC"}
                        </div>
                        <div className="text-[9px] text-neutral-500">/ mois</div>
                        <div className="text-[10px] text-neutral-400 mt-1 leading-tight">{tier.desc}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Estimation devis par forfait */}
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]/60">
                    <Receipt className="w-3.5 h-3.5 text-emerald-300" />
                    <span className="text-[12px] font-medium text-neutral-200">
                      Devis estimés pour {prospectName}
                    </span>
                  </div>
                  <div className="divide-y divide-[var(--color-border)]">
                    {leadsData.map((ld) => {
                      const tierInfo = report.ads_tiers!.find((t) => t.key === ld.key);
                      const isTop = ld.key === "top1";
                      const isMid = ld.key === "performance";
                      return (
                        <div key={ld.key} className="px-3 py-2.5 flex items-center gap-3">
                          <div className={`shrink-0 w-16 text-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isTop ? "bg-violet-500/15 text-violet-300" : isMid ? "bg-amber-500/10 text-amber-300" : "bg-neutral-800 text-neutral-400"
                          }`}>
                            {ld.label}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-[15px] font-bold font-mono text-emerald-300">{ld.leads}</span>
                              <span className="text-[11px] text-neutral-400">demandes de devis / mois</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] text-neutral-500">
                                {ld.clicksPerMonth} clics × {Math.round((ld.leads / ld.clicksPerMonth) * 100)}% conversion
                              </span>
                              <span className="text-[10px] text-neutral-600">|</span>
                              <span className="text-[10px] text-neutral-500">
                                ~{ld.signedDevis} signés → <span className="text-emerald-400 font-semibold">{ld.revenueMensuel.toLocaleString("fr-FR")}{"\u20AC"}</span> CA/mois
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-3 py-2 bg-[var(--color-surface)]/60 border-t border-[var(--color-border)]">
                    <div className="text-[9px] text-neutral-500 leading-relaxed">
                      Basé sur un taux de conversion de {Math.round((leadsData[0]?.leads / leadsData[0]?.clicksPerMonth) * 100)}% (moyenne {metier}) et un panier moyen de {leadsData[0]?.panier}{"\u20AC"} HT, taux de signature 35%.
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : report.ads_budget_est != null ? (
            <div className="px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-violet-300" />
                <span className="text-[12px] font-medium text-neutral-200">
                  Budget Google Ads
                </span>
              </div>
              <div className="text-lg font-bold text-neutral-100 font-mono">
                {report.ads_budget_est}{"\u20AC"} <span className="text-sm font-normal text-neutral-500">/ mois</span>
              </div>
            </div>
          ) : null}

          {/* Sales arguments */}
          <SalesArguments
            prospectName={prospectName}
            prospectScore={prospectScore}
            competitors={report.competitors}
            adsBudget={report.ads_tiers?.[1]?.budget ?? report.ads_budget_est}
          />

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const prospectRank = rankedList.findIndex((c) => c.isProspect) + 1;
                generateProspectReport({
                  report,
                  prospectName,
                  prospectRating,
                  prospectReviews,
                  prospectScore,
                  prospectRank: prospectRank || rankedList.length,
                });
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 text-[12px] font-medium transition"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
            {prospectPhone && (
              <a
                href={whatsAppUrl(prospectPhone, salesWhatsAppMsg(prospectName, metier, ville))}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 text-[12px] font-medium transition"
              >
                <MessageSquareQuote className="w-3.5 h-3.5" />
                Pitch WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Sales Arguments sub-component ---------- */

function SalesArguments({
  prospectName,
  prospectScore,
  competitors,
  adsBudget,
}: {
  prospectName: string;
  prospectScore: number;
  competitors: import("../lib/types").CompetitorResult[];
  adsBudget: number | null;
}) {
  const [copied, setCopied] = useState<number | null>(null);

  const args = generateSalesArgs(prospectName, prospectScore, competitors, adsBudget);

  if (args.length === 0) return null;

  const copyArg = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(args.join("\n\n"));
    setCopied(-1);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MessageSquareQuote className="w-3.5 h-3.5 text-violet-300" />
          <span className="text-[12px] font-medium text-neutral-200">
            Arguments de vente
          </span>
        </div>
        <button
          onClick={copyAll}
          className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-violet-300 transition"
        >
          {copied === -1 ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied === -1 ? "Copi\u00E9" : "Tout copier"}
        </button>
      </div>
      {args.map((arg, i) => (
        <button
          key={i}
          onClick={() => copyArg(arg, i)}
          className="w-full text-left group flex items-start gap-2 text-[11px] text-neutral-300 hover:text-neutral-100 transition"
          title="Cliquer pour copier"
        >
          <span className="shrink-0 mt-0.5">
            {copied === i ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-neutral-600 group-hover:text-violet-400" />
            )}
          </span>
          <span>{arg}</span>
        </button>
      ))}
    </div>
  );
}

