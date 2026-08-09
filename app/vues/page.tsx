"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  Flame,
  Loader2,
  RefreshCw,
  Phone,
  ExternalLink,
  Rocket,
  Clock,
  Search,
  MessageCircle,
} from "lucide-react";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { demoUrl, whatsAppUrl } from "@/app/lib/links";
import type { Status } from "@/app/lib/types";

/* ── Types ── */
interface ViewRow {
  prospect_id: string;
  event: string;
  duration_seconds: number | null;
  created_at: string;
}

interface ProspectRow {
  id: string;
  name: string;
  ville: string | null;
  metier: string | null;
  phone: string | null;
  rating: number | null;
  reviews: number | null;
  status: Status;
  demo_expires_at: string | null;
  paid_at: string | null;
}

interface Viewer {
  prospect: ProspectRow;
  visits: number;
  lastViewAt: string;
  totalSeconds: number;
  cta: boolean;
}

type Filter = "all" | "hot" | "cta";

const STATUS_LABELS: Record<Status, { label: string; cls: string }> = {
  todo: { label: "À appeler", cls: "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]" },
  called: { label: "Appelé", cls: "bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  sms_sent: { label: "SMS envoyé", cls: "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  positive: { label: "Intéressé", cls: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  negative: { label: "Pas intéressé", cls: "bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  no_answer: { label: "Sans réponse", cls: "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" },
};

/* ── Helpers ── */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`;
}

function expiryLabel(iso: string | null): { text: string; urgent: boolean } | null {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: "démo expirée", urgent: false };
  if (days === 0) return { text: "expire aujourd'hui", urgent: true };
  return { text: `expire dans ${days} j`, urgent: days <= 2 };
}

export default function VuesPage() {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: views, error: vErr } = await supabase
        .from("demo_views")
        .select("prospect_id, event, duration_seconds, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (vErr) throw vErr;

      const byProspect = new Map<string, { visits: number; lastViewAt: string; totalSeconds: number; cta: boolean }>();
      for (const v of (views ?? []) as ViewRow[]) {
        let agg = byProspect.get(v.prospect_id);
        if (!agg) {
          agg = { visits: 0, lastViewAt: v.created_at, totalSeconds: 0, cta: false };
          byProspect.set(v.prospect_id, agg);
        }
        if (v.event === "cta_click") {
          agg.cta = true;
        } else {
          agg.visits += 1;
          agg.totalSeconds += v.duration_seconds ?? 0;
          if (v.created_at > agg.lastViewAt) agg.lastViewAt = v.created_at;
        }
      }
      // Un clic CTA sans session "view" trackée compte quand même comme une visite.
      for (const agg of byProspect.values()) if (agg.visits === 0) agg.visits = 1;

      const ids = [...byProspect.keys()];
      if (ids.length === 0) {
        setViewers([]);
        return;
      }

      const { data: prospects, error: pErr } = await supabase
        .from("prospects")
        .select("id, name, ville, metier, phone, rating, reviews, status, demo_expires_at, paid_at")
        .in("id", ids);
      if (pErr) throw pErr;

      const list: Viewer[] = ((prospects ?? []) as ProspectRow[]).map((p) => ({
        prospect: p,
        ...byProspect.get(p.id)!,
      }));
      list.sort((a, b) => b.lastViewAt.localeCompare(a.lastViewAt));
      setViewers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!supabaseConfigured) {
      setError("Supabase non configuré");
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return viewers.filter((v) => {
      if (filter === "hot" && v.visits < 2 && !v.cta) return false;
      if (filter === "cta" && !v.cta) return false;
      if (q && !`${v.prospect.name} ${v.prospect.ville ?? ""} ${v.prospect.metier ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [viewers, filter, query]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      total: viewers.length,
      cta: viewers.filter((v) => v.cta).length,
      today: viewers.filter((v) => new Date(v.lastViewAt) >= today).length,
    };
  }, [viewers]);

  return (
    <main className="min-h-screen">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-white dark:bg-[#111114] border-b border-[var(--color-border)] px-3 md:px-6 py-3">
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <Link href="/" className="p-2 rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 text-[var(--color-text-secondary)] hover:text-violet-600 dark:hover:text-violet-300 transition" title="Retour aux prospects">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-5 h-5 text-violet-500 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display text-[20px] md:text-[24px] leading-none tracking-tight text-[var(--color-text-primary)]">
                Vues démo
              </h1>
              <p className="text-[10px] md:text-[11px] text-[var(--color-text-muted)] mt-0.5 font-mono-num truncate">
                {stats.total} prospect{stats.total > 1 ? "s ont" : " a"} ouvert sa démo · {stats.cta} CTA · {stats.today} aujourd&apos;hui
              </p>
            </div>
          </div>
          <button onClick={load} className="ml-auto p-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text-secondary)] transition" title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="px-3 md:px-6 py-4 max-w-4xl mx-auto">
        {/* ── Filtres ── */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(
            [
              ["all", "Tous"],
              ["hot", "Chauds 🔥"],
              ["cta", "CTA cliqué 🚀"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-[13px] rounded-lg border transition ${
                filter === key
                  ? "border-violet-500/60 bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 font-medium"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-violet-500/40"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Nom, ville, métier…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50 transition w-[200px]"
            />
          </div>
        </div>

        {/* ── États ── */}
        {error && (
          <div className="px-4 py-3 rounded-xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/5 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        {loading && viewers.length === 0 && !error && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">
            {viewers.length === 0 ? "Personne n'a encore ouvert sa démo." : "Aucun résultat avec ce filtre."}
          </p>
        )}

        {/* ── Liste ── */}
        <ul className="space-y-2">
          {filtered.map((v) => {
            const p = v.prospect;
            const st = STATUS_LABELS[p.status] ?? STATUS_LABELS.todo;
            const exp = expiryLabel(p.demo_expires_at);
            const hot = v.cta || v.visits >= 3 ? 2 : v.visits >= 2 ? 1 : 0;
            return (
              <li
                key={p.id}
                className={`rounded-xl border bg-[var(--color-surface)] px-3.5 py-3 transition hover:border-violet-500/40 ${
                  v.cta ? "border-amber-400/60 dark:border-amber-500/40" : "border-[var(--color-border)]"
                }`}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">{p.name}</span>
                      {hot > 0 && (
                        <span className="flex items-center text-amber-500" title={`${v.visits} visites`}>
                          <Flame className="w-3.5 h-3.5" />
                          {hot > 1 && <Flame className="w-3.5 h-3.5 -ml-1.5" />}
                        </span>
                      )}
                      {v.cta && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wide">
                          <Rocket className="w-3 h-3" /> Je le veux
                        </span>
                      )}
                      {p.paid_at && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wide">
                          Payé
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5 truncate">
                      {[p.metier, p.ville].filter(Boolean).join(" · ")}
                      {p.rating != null && <span className="font-mono-num"> · ⭐ {p.rating} ({p.reviews ?? 0})</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--color-text-muted)] font-mono-num flex-wrap">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {v.visits} visite{v.visits > 1 ? "s" : ""}
                      </span>
                      {v.totalSeconds > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {fmtDuration(v.totalSeconds)}
                        </span>
                      )}
                      <span className="text-violet-500 dark:text-violet-400 font-medium">{relTime(v.lastViewAt)}</span>
                      {exp && <span className={exp.urgent ? "text-rose-500 font-semibold" : ""}>{exp.text}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.phone && (
                      <a
                        href={`tel:${p.phone.replace(/\s/g, "")}`}
                        className="p-2 rounded-lg border border-[var(--color-border)] hover:border-emerald-500/50 text-[var(--color-text-muted)] hover:text-emerald-500 transition"
                        title={`Appeler ${p.phone}`}
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    {p.phone && (
                      <a
                        href={whatsAppUrl(p.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg border border-[var(--color-border)] hover:border-emerald-500/50 text-[var(--color-text-muted)] hover:text-emerald-500 transition"
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}
                    <a
                      href={demoUrl(p.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 text-[var(--color-text-muted)] hover:text-violet-500 transition"
                      title="Voir sa démo"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
