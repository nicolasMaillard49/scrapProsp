"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Copy, Check, ExternalLink, Send, Eye, Users, Hash, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { instagramDmMsg } from "@/app/lib/instagram";
import { shortCode } from "@/app/lib/links";

interface IgLead {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  external_url: string | null;
  followers: number | null;
  category: string | null;
  metier: string | null;
  ville: string | null;
  booking_platform: string | null;
  hashtag_source: string | null;
  status: string;
  notes: string;
  discovered_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  todo: "A contacter",
  contacted: "Contacte",
  positive: "Positif",
  negative: "Negatif",
};

const STATUS_STYLES: Record<string, { pill: string; pillActive: string }> = {
  todo: {
    pill: "border-[var(--color-border)] text-[var(--color-text-muted)]",
    pillActive: "bg-[var(--color-text-muted)] text-white border-transparent",
  },
  contacted: {
    pill: "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400",
    pillActive: "bg-blue-600 text-white border-transparent",
  },
  positive: {
    pill: "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400",
    pillActive: "bg-emerald-600 text-white border-transparent",
  },
  negative: {
    pill: "border-rose-300 text-rose-600 dark:border-rose-700 dark:text-rose-400",
    pillActive: "bg-rose-600 text-white border-transparent",
  },
};

export default function InstagramPage() {
  const [hashtag, setHashtag] = useState("");
  const [target, setTarget] = useState(100);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [leads, setLeads] = useState<IgLead[]>([]);
  const [filter, setFilter] = useState<string>("todo");
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [expandedDm, setExpandedDm] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loadLeads = useCallback(async () => {
    if (!supabaseConfigured) return;
    // Sémantique « sans site » de cette page : on exclut les profils avec un vrai
    // site (insérés par le pipeline /instagram/prospection avec keepAll=true).
    const { data } = await supabase
      .from("instagram_prospects")
      .select("*")
      .or("has_website.is.null,has_website.eq.false")
      .order("discovered_at", { ascending: false })
      .limit(1000);
    setLeads((data ?? []) as IgLead[]);
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const runDiscover = useCallback(async () => {
    const tag = hashtag.replace(/^#/, "").trim();
    if (!tag) {
      setMsg("Entre un hashtag (ex. coiffeurbordeaux).");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/instagram/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashtag: tag, target }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(`Erreur : ${json.error ?? res.status}`);
      } else {
        setMsg(
          `${json.inserted} nouveaux leads (${json.qualified} sans site sur ${json.scanned} comptes scannes)` +
            (json.capHit ? " — plafond atteint." : "") +
            (json.note ? ` ${json.note}` : ""),
        );
        await loadLeads();
      }
    } catch (e) {
      setMsg(`Erreur reseau : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [hashtag, target, loadLeads]);

  const setStatus = useCallback(async (id: string, status: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch(`/api/instagram/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }, []);

  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }, []);

  const shown = useMemo(() => leads.filter((l) => filter === "all" || l.status === filter), [leads, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length, todo: 0, contacted: 0, positive: 0, negative: 0 };
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] truncate">
                Prospection Instagram
              </h1>
              <p className="text-xs text-[var(--color-text-muted)] hidden sm:block">
                Comptes pros sans site web — messages prets a envoyer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/instagram/prospection"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition no-underline"
            >
              <Hash className="w-3.5 h-3.5" /> Hashtags + export
            </Link>
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
              <Users className="w-4 h-4" />
              <span className="font-mono-num">{leads.length}</span>
              <span className="hidden sm:inline">leads</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Search bar */}
        <div className="glass-card rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                Hashtag
              </label>
              <div className="flex items-center glass-input rounded-lg px-3">
                <Hash className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                <input
                  value={hashtag}
                  onChange={(e) => setHashtag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && runDiscover()}
                  placeholder="coiffeurbordeaux"
                  className="flex-1 bg-transparent border-none outline-none px-2 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                />
              </div>
            </div>
            <div className="w-full sm:w-24">
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                Cible
              </label>
              <input
                type="number"
                min={1}
                max={300}
                value={target}
                onChange={(e) => setTarget(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={runDiscover}
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all cursor-pointer disabled:cursor-wait bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? "Recherche..." : "Rechercher"}
              </button>
            </div>
          </div>
        </div>

        {/* Message */}
        {msg && (
          <div className={`rounded-lg px-4 py-3 text-sm border animate-slide-up ${
            msg.startsWith("Erreur")
              ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300"
              : "bg-[var(--color-accent-soft)] border-[var(--color-accent)]/30 text-[var(--color-accent)] dark:text-violet-300"
          }`}>
            {msg}
          </div>
        )}

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {(["todo", "contacted", "positive", "negative", "all"] as const).map((s) => {
            const active = filter === s;
            const styles = STATUS_STYLES[s] ?? STATUS_STYLES.todo;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                  active
                    ? s === "all"
                      ? "bg-[var(--color-text-primary)] text-[var(--color-background)] border-transparent"
                      : styles.pillActive
                    : s === "all"
                      ? "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
                      : `${styles.pill} hover:opacity-80`
                }`}
              >
                {s === "all" ? "Tous" : STATUS_LABEL[s]}
                <span className="ml-1.5 font-mono-num">{counts[s] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* Leads list */}
        {shown.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-2xl border-dashed">
            <Search className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
            <p className="text-[var(--color-text-muted)] text-sm">
              Aucun lead. Lance une recherche par hashtag ci-dessus.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shown.map((l) => {
              const link = origin ? `${origin}/di/${shortCode(l.id)}` : "";
              const dm = instagramDmMsg({ metier: l.metier ?? "", ville: l.ville ?? "", bookingPlatform: l.booking_platform }, link);
              const dmExpanded = expandedDm === l.id;
              const sty = STATUS_STYLES[l.status] ?? STATUS_STYLES.todo;

              return (
                <div
                  key={l.id}
                  className="glass-card rounded-2xl p-4 sm:p-5 animate-fade-in"
                >
                  {/* Top row: username + status */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <a
                          href={`https://instagram.com/${l.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-[var(--color-accent)] hover:underline"
                        >
                          @{l.username}
                        </a>
                        {l.full_name && (
                          <span className="text-sm text-[var(--color-text-secondary)]">{l.full_name}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-[var(--color-text-muted)]">
                        {l.followers != null && (
                          <span className="font-mono-num">{l.followers.toLocaleString("fr-FR")} abonnes</span>
                        )}
                        {l.category && <span>· {l.category}</span>}
                        {l.metier && <span>· {l.metier}</span>}
                        {l.ville && <span>· {l.ville}</span>}
                        {l.booking_platform && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">· {l.booking_platform}</span>
                        )}
                        {l.hashtag_source && <span>· #{l.hashtag_source}</span>}
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs font-bold rounded-full px-2.5 py-0.5 border ${
                      l.status === filter && filter !== "all" ? sty.pillActive : sty.pill
                    }`}>
                      {STATUS_LABEL[l.status] ?? l.status}
                    </span>
                  </div>

                  {/* Bio */}
                  {l.bio && (
                    <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line mb-3 line-clamp-2">
                      {l.bio}
                    </p>
                  )}

                  {/* DM section — collapsible */}
                  <button
                    onClick={() => setExpandedDm(dmExpanded ? null : l.id)}
                    className="text-xs font-semibold text-[var(--color-accent)] hover:underline cursor-pointer mb-2"
                  >
                    {dmExpanded ? "Masquer les messages" : "Voir les messages DM"}
                  </button>

                  {dmExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 animate-slide-up">
                      {([["Avec lien", dm.withLink, `${l.id}-w`], ["Tease", dm.tease, `${l.id}-t`]] as const).map(([title, text, key]) => (
                        <div key={key} className="glass-input rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                              {title}
                            </span>
                            <button
                              onClick={() => copy(key, text)}
                              className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:opacity-80 transition cursor-pointer"
                            >
                              {copied === key ? (
                                <><Check className="w-3 h-3" /> Copie</>
                              ) : (
                                <><Copy className="w-3 h-3" /> Copier</>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-line leading-relaxed">
                            {text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                    <a
                      href={`https://instagram.com/${l.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-text-primary)] text-[var(--color-background)] hover:opacity-90 transition no-underline"
                    >
                      <Send className="w-3 h-3" />
                      Ouvrir le DM
                    </a>
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition no-underline"
                      >
                        <Eye className="w-3 h-3" />
                        Apercu
                      </a>
                    )}
                    <span className="flex-1" />
                    {(["contacted", "positive", "negative"] as const).map((s) => {
                      const st = STATUS_STYLES[s];
                      const active = l.status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setStatus(l.id, s)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer ${
                            active ? st.pillActive : st.pill
                          } hover:opacity-80`}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
