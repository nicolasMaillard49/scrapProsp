"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ExternalLink, Heart, MessageCircle, Bookmark, Share2,
  Eye, Users, Film, Images, Image as ImageIcon, Loader2, RefreshCw,
} from "lucide-react";

interface Account {
  username: string;
  account_type: string;
  media_count: number;
  followers_count?: number;
  follows_count?: number;
}
interface Media {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  reach: number;
  saved: number;
  shares: number;
  engagement: number;
  engagementRate: number | null;
}
interface Insight {
  name: string;
  values: { value: number; end_time?: string }[];
}

const nf = new Intl.NumberFormat("fr-FR");
const lastVal = (ins: Insight[], name: string) => {
  const vals = ins.find((i) => i.name === name)?.values ?? [];
  return vals.length ? vals[vals.length - 1].value : null;
};

const MEDIA_ICON = { VIDEO: Film, CAROUSEL_ALBUM: Images, IMAGE: ImageIcon } as const;

export default function InstagramStatsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/instagram/graph");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
      setAccount(json.account ?? null);
      setMedia(json.media ?? []);
      setInsights(json.insights ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reachDay = lastVal(insights, "reach");
  const profileViews = lastVal(insights, "profile_views");

  // Agrégats sur les posts chargés
  const totReach = media.reduce((s, m) => s + m.reach, 0);
  const avgEng = media.length
    ? Math.round((media.reduce((s, m) => s + (m.engagementRate ?? 0), 0) / media.filter((m) => m.engagementRate != null).length) * 10) / 10
    : 0;

  const STATS: { label: string; value: string; icon: typeof Users; hint?: string }[] = [
    { label: "Abonnés", value: account?.followers_count != null ? nf.format(account.followers_count) : "—", icon: Users },
    { label: "Couverture (jour)", value: reachDay != null ? nf.format(reachDay) : "—", icon: Eye, hint: "comptes uniques touchés aujourd'hui" },
    { label: "Vues du profil (jour)", value: profileViews != null ? nf.format(profileViews) : "—", icon: ExternalLink },
    { label: "Engagement moyen", value: media.length ? `${avgEng} %` : "—", icon: Heart, hint: "interactions / couverture, sur les 12 derniers posts" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="sticky top-0 z-30 bg-[var(--color-surface)]/90 backdrop-blur-sm border-b border-[var(--color-border)]">
        <div className="px-4 sm:px-6 xl:px-8 h-14 flex items-center gap-4">
          <Link
            href="/instagram"
            className="shrink-0 p-1.5 -ml-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <h1 className="font-display text-xl sm:text-2xl text-[var(--color-text-primary)] truncate">
            Performance {account ? `@${account.username}` : "Instagram"}
          </h1>
          <span className="flex-1" />
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 xl:px-8 py-8 space-y-8 max-w-6xl mx-auto xl:mx-0 xl:max-w-none">
        {error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-500/25 bg-rose-50/60 dark:bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Bandeau de stats compte */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                <s.icon className="w-3.5 h-3.5" /> {s.label}
              </div>
              <div className="font-mono-num text-2xl font-semibold text-[var(--color-text-primary)] tabular-nums">
                {loading && !account ? "…" : s.value}
              </div>
              {s.hint && <div className="text-[11px] text-[var(--color-text-muted)] mt-1">{s.hint}</div>}
            </div>
          ))}
        </div>

        {/* Top posts par engagement */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Posts par engagement</h2>
            <p className="text-xs text-[var(--color-text-muted)]">12 derniers médias · couverture totale {nf.format(totReach)}</p>
          </div>

          {loading && media.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <Loader2 className="w-7 h-7 text-[var(--color-text-muted)] mx-auto animate-spin opacity-50" />
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)] overflow-hidden">
              {media.map((m, i) => {
                const Icon = MEDIA_ICON[m.media_type] ?? ImageIcon;
                const caption = (m.caption ?? "").replace(/\s+/g, " ").trim();
                return (
                  <div key={m.id} className="flex items-start gap-3 p-4 hover:bg-[var(--color-surface-2)]/60 transition-colors">
                    <span className="shrink-0 w-6 pt-0.5 font-mono-num text-sm font-semibold text-[var(--color-text-muted)] text-right">{i + 1}</span>
                    <span className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={m.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        <span className="truncate max-w-[46ch]">{caption || "(sans légende)"}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                      </a>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                        <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-[var(--color-text-muted)]" /><span className="font-mono-num">{nf.format(m.reach)}</span></span>
                        <span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500" /><span className="font-mono-num">{nf.format(m.like_count ?? 0)}</span></span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-blue-500" /><span className="font-mono-num">{nf.format(m.comments_count ?? 0)}</span></span>
                        <span className="inline-flex items-center gap-1"><Bookmark className="w-3.5 h-3.5 text-amber-500" /><span className="font-mono-num">{nf.format(m.saved)}</span></span>
                        <span className="inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5 text-emerald-500" /><span className="font-mono-num">{nf.format(m.shares)}</span></span>
                        <span className="text-[var(--color-text-muted)]">{new Date(m.timestamp).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono-num text-lg font-semibold text-[var(--color-accent)] tabular-nums">{nf.format(m.engagement)}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">
                        interactions{m.engagementRate != null ? ` · ${m.engagementRate}%` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-[var(--color-text-muted)]">
            Données live via l&apos;API Graph Instagram · l&apos;engagement = (likes + commentaires + saves + partages) ÷ couverture.
          </p>
        </section>
      </main>
    </div>
  );
}
