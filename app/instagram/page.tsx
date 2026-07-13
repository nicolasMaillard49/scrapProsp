"use client";

// Page unique de prospection Instagram :
//  - EN HAUT : l'outil (génération de hashtags, scan Apify, qualification IA, exports)
//  - EN DESSOUS : la liste des prospects obtenus, du plus récent au plus ancien,
//    avec filtres statut (contacté ou pas…), métier, priorité (score), verdict IA, sans site.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Copy, Check, ExternalLink, Send, Eye, Loader2, ArrowLeft, Gauge, Bell, Plus, PhoneCall, XCircle, ChevronRight, Hash, BarChart3 } from "lucide-react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { instagramDmSequence, detectMetier, detectTrame, competitorHook, TRAME_LABEL, type TrameKind } from "@/app/lib/instagram";
import { STAGE_LABEL, type Stage } from "@/app/lib/igPipeline";
import { shortCode } from "@/app/lib/links";
import type { IgCompetitorReport } from "@/app/lib/igCompetitor";
import ProspectionTool from "./ProspectionTool";

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
  email: string | null;
  phone: string | null;
  has_website: boolean | null;
  score: number | null;
  score_tier: string | null;
  qualification: string | null;
  qualification_reason: string | null;
  profession_ia: string | null;
  last_post_at: string | null;
  stage: string | null;
  followup_count: number | null;
  next_followup_at: string | null;
  contacted_by: string | null;
}

interface IgAccount {
  id: string;
  username: string;
  status: "warmup" | "chaud" | "pause";
  started_at: string;
  caps: { daily: number; day: number };
  sentDay: number;
}

interface DueFollowup {
  id: string;
  username: string;
  stage: string | null;
  followup_count: number;
  next_followup_at: string;
}

interface PeriodStats {
  sent: number;
  m1: number;
  relances: number;
  added: number;
}

interface SendStats {
  day: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
}

const STATUS_LABEL: Record<string, string> = {
  todo: "A contacter",
  contacted: "Contacte",
  positive: "Positif",
  negative: "Negatif",
};

/* Statuts : teinte douce + texte coloré (l'aplat saturé est réservé à la sélection). */
const STATUS_STYLES: Record<string, { pill: string; pillActive: string }> = {
  todo: {
    pill: "border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-surface)]",
    pillActive: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-400/40",
  },
  contacted: {
    pill: "border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-500/5",
    pillActive: "bg-blue-600 text-white border-transparent",
  },
  positive: {
    pill: "border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5",
    pillActive: "bg-emerald-600 text-white border-transparent",
  },
  negative: {
    pill: "border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/5",
    pillActive: "bg-rose-600 text-white border-transparent",
  },
};

/* Score : pastille discrète (couleur = état, jamais déco) + valeur tabulaire. */
const TIER_DOT: Record<string, { dot: string; text: string; label: string }> = {
  hot: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400", label: "Hot" },
  warm: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Warm" },
  cold: { dot: "bg-slate-400", text: "text-slate-500 dark:text-slate-400", label: "Cold" },
};

const QUALIF_BADGE: Record<string, { label: string; cls: string }> = {
  qualified: { label: "Qualifié IA", cls: "text-emerald-700 dark:text-emerald-400" },
  borderline: { label: "Limite IA", cls: "text-amber-700 dark:text-amber-400" },
  rejected: { label: "Écarté IA", cls: "text-rose-700 dark:text-rose-400" },
};

export default function InstagramPage() {
  const [leads, setLeads] = useState<IgLead[]>([]);
  // Le scraper sert quelques fois par semaine ; la file d'envoi sert tous les
  // jours → l'outil est replié par défaut pour laisser le cockpit en tête.
  const [toolOpen, setToolOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [metierFilter, setMetierFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [qualifFilter, setQualifFilter] = useState<string>("all");
  const [noSiteOnly, setNoSiteOnly] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [expandedDm, setExpandedDm] = useState<string | null>(null);
  // Rapport concurrentiel par prospect (panneau repliable, chargé à la demande).
  const [expandedComp, setExpandedComp] = useState<string | null>(null);
  const [compReports, setCompReports] = useState<Record<string, IgCompetitorReport>>({});
  const [compLoading, setCompLoading] = useState<string | null>(null);
  const [compError, setCompError] = useState<Record<string, string>>({});
  const [villeInput, setVilleInput] = useState<Record<string, string>>({});

  // ── Cockpit (comptes émetteurs, quotas, relances) ──
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [due, setDue] = useState<DueFollowup[]>([]);
  const [stats, setStats] = useState<SendStats | null>(null);
  const [activeAccount, setActiveAccount] = useState<string>("");
  const [newAccount, setNewAccount] = useState("");
  const [cockpitMsg, setCockpitMsg] = useState<string | null>(null);
  // Trame choisie par prospect (défaut : suggestion detectTrame, surchargeable).
  const [trameChoice, setTrameChoice] = useState<Record<string, TrameKind>>({});

  useEffect(() => {
    setOrigin(window.location.origin);
    setActiveAccount(localStorage.getItem("ig_active_account") ?? "");
  }, []);

  const loadCockpit = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/accounts");
      if (!res.ok) return;
      const json = await res.json();
      setAccounts(json.accounts ?? []);
      setDue(json.due ?? []);
      setStats(json.stats ?? null);
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    loadCockpit();
  }, [loadCockpit]);

  const pickAccount = useCallback((id: string) => {
    setActiveAccount(id);
    localStorage.setItem("ig_active_account", id);
  }, []);

  const addAccount = useCallback(async () => {
    const username = newAccount.replace(/^@/, "").trim();
    if (!username) return;
    const res = await fetch("/api/instagram/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const json = await res.json();
    if (!res.ok) {
      setCockpitMsg(`Erreur : ${json.error ?? res.status}`);
      return;
    }
    setNewAccount("");
    setCockpitMsg(`Compte @${username} ajouté (chauffe J1 : 5 messages/jour).`);
    await loadCockpit();
  }, [newAccount, loadCockpit]);

  const setAccountStatus = useCallback(async (id: string, status: string) => {
    await fetch(`/api/instagram/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadCockpit();
  }, [loadCockpit]);

  const sendDigest = useCallback(async () => {
    setCockpitMsg("Envoi du récap Telegram…");
    const res = await fetch("/api/instagram/digest", { method: "POST" });
    const json = await res.json();
    setCockpitMsg(res.ok ? "📊 Récap envoyé sur Telegram." : `Erreur : ${json.error ?? res.status}`);
  }, []);

  /** Marque une étape de la séquence comme envoyée (compte actif requis). */
  const markSent = useCallback(async (prospectId: string, step: string) => {
    if (!activeAccount) {
      setCockpitMsg("Sélectionne d'abord un compte émetteur actif dans le cockpit.");
      return;
    }
    const res = await fetch("/api/instagram/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospect_id: prospectId, account_id: activeAccount, step }),
    });
    const json = await res.json();
    if (!res.ok) {
      setCockpitMsg(json.error ?? `Erreur ${res.status}`);
      return;
    }
    const p = json.prospect as Partial<IgLead>;
    setLeads((prev) => prev.map((l) => (l.id === prospectId ? { ...l, ...p } : l)));
    const acc = accounts.find((a) => a.id === activeAccount);
    setCockpitMsg(`${step} noté envoyé${acc ? ` avec @${acc.username} (${json.counters.day}/${json.counters.caps.daily} aujourd'hui)` : ""}.`);
    await loadCockpit();
  }, [activeAccount, accounts, loadCockpit]);

  /** « Vu sans réponse » → programme la relance suivante (R1 +1 h…). */
  const markSeen = useCallback(async (prospectId: string) => {
    const res = await fetch(`/api/instagram/${prospectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen: true }),
    });
    const json = await res.json();
    if (res.ok) {
      setLeads((prev) => prev.map((l) => (l.id === prospectId ? { ...l, ...json.prospect } : l)));
      await loadCockpit();
    }
  }, [loadCockpit]);

  /** Transition manuelle du pipeline (call booké / perdu). */
  const setStage = useCallback(async (prospectId: string, stage: Stage) => {
    const res = await fetch(`/api/instagram/${prospectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    const json = await res.json();
    if (res.ok) {
      setLeads((prev) => prev.map((l) => (l.id === prospectId ? { ...l, ...json.prospect } : l)));
      await loadCockpit();
    }
  }, [loadCockpit]);

  /**
   * Ouvre/ferme le rapport concurrentiel d'un prospect. Charge à la demande
   * (scrape Maps + détection Ads, plusieurs secondes) et met en cache dans l'état :
   * ré-ouvrir n'entraîne pas un nouveau scrape.
   */
  const toggleCompetitors = useCallback(
    async (prospectId: string) => {
      if (expandedComp === prospectId) {
        setExpandedComp(null);
        return;
      }
      setExpandedComp(prospectId);
      if (compReports[prospectId] || compLoading === prospectId) return;
      setCompLoading(prospectId);
      setCompError((prev) => {
        const { [prospectId]: _drop, ...rest } = prev;
        return rest;
      });
      try {
        const res = await fetch(`/api/instagram/${prospectId}/competitors`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
        setCompReports((prev) => ({ ...prev, [prospectId]: json as IgCompetitorReport }));
      } catch (e) {
        setCompError((prev) => ({ ...prev, [prospectId]: e instanceof Error ? e.message : String(e) }));
      } finally {
        setCompLoading((cur) => (cur === prospectId ? null : cur));
      }
    },
    [expandedComp, compReports, compLoading],
  );

  /** Enregistre une ville saisie à la main (prospect sans ville) puis lance le rapport. */
  const saveVilleAndAnalyze = useCallback(
    async (prospectId: string) => {
      const ville = (villeInput[prospectId] ?? "").trim();
      if (!ville) return;
      const res = await fetch(`/api/instagram/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ville }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCompError((prev) => ({ ...prev, [prospectId]: json.error ?? `Erreur ${res.status}` }));
        return;
      }
      setLeads((prev) => prev.map((l) => (l.id === prospectId ? { ...l, ville } : l)));
      await toggleCompetitors(prospectId);
    },
    [villeInput, toggleCompetitors],
  );

  // Charge TOUS les prospects, du plus récent au plus ancien.
  const loadLeads = useCallback(async () => {
    if (!supabaseConfigured) return;
    setLoading(true);
    const { data } = await supabase
      .from("instagram_prospects")
      .select("*")
      .order("discovered_at", { ascending: false })
      .limit(2000);
    setLeads((data ?? []) as IgLead[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

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

  // Métiers présents en base (pour le filtre).
  const metiers = useMemo(() => {
    const s = new Set<string>();
    for (const l of leads) if (l.metier) s.add(l.metier);
    return Array.from(s).sort();
  }, [leads]);

  const shown = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (metierFilter !== "all" && l.metier !== metierFilter) return false;
      if (tierFilter !== "all" && l.score_tier !== tierFilter) return false;
      if (qualifFilter !== "all" && l.qualification !== (qualifFilter === "none" ? null : qualifFilter)) return false;
      if (noSiteOnly && l.has_website === true) return false;
      if (q && !`${l.username} ${l.full_name ?? ""} ${l.ville ?? ""} ${l.bio ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, statusFilter, metierFilter, tierFilter, qualifFilter, noSiteOnly, searchText]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length, todo: 0, contacted: 0, positive: 0, negative: 0 };
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface)]/90 backdrop-blur-sm border-b border-[var(--color-border)]">
        <div className="px-4 sm:px-6 xl:px-8 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="shrink-0 p-1.5 -ml-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <h1 className="font-display text-xl sm:text-2xl text-[var(--color-text-primary)] truncate">
            Prospection Instagram
          </h1>
          <span className="flex-1" />
          <Link
            href="/instagram/stats"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors no-underline"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Performance
          </Link>
          <span className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-mono-num font-medium text-[var(--color-text-primary)]">{leads.length.toLocaleString("fr-FR")}</span>
            <span className="hidden sm:inline"> prospects en base</span>
          </span>
        </div>
      </header>

      <main className="px-4 sm:px-6 xl:px-8 py-8 space-y-8">
        {/* ─── SCRAPER (replié par défaut — la file d'envoi d'abord) ─── */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <button
            onClick={() => setToolOpen((o) => !o)}
            aria-expanded={toolOpen}
            className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left cursor-pointer group"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)] shrink-0">
              <Hash className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--color-text-primary)]">Trouver de nouveaux prospects</span>
              <span className="block text-xs text-[var(--color-text-muted)] truncate">Hashtags → scan Apify → qualification IA → exports</span>
            </span>
            <ChevronRight
              className={`w-4 h-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 group-hover:text-[var(--color-text-secondary)] ${toolOpen ? "rotate-90" : ""}`}
            />
          </button>
          {toolOpen && (
            <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-[var(--color-border)] animate-fade-in">
              <div className="pt-4">
                <ProspectionTool onDataChanged={loadLeads} />
              </div>
            </div>
          )}
        </section>

        {/* ─── COCKPIT (colonne latérale ≥ xl) + LISTE — la page occupe toute la largeur ─── */}
        <div className="grid grid-cols-1 xl:grid-cols-[400px_minmax(0,1fr)] 2xl:grid-cols-[440px_minmax(0,1fr)] gap-8 items-start">
        <section className="space-y-4 min-w-0 xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100vh-5.5rem)] xl:overflow-y-auto">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Cockpit d'envoi</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              envoi 100 % manuel — l'outil trace, compte les quotas et programme les relances
            </p>
            <span className="flex-1" />
            <button
              onClick={sendDigest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" /> Récap Telegram
            </button>
          </div>

          {/* Comptes émetteurs — la carte entière sélectionne le compte actif */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1 gap-3">
            {accounts.map((a) => {
              const dayPct = a.caps.daily ? Math.min(100, (a.sentDay / a.caps.daily) * 100) : 100;
              const full = a.caps.daily > 0 && a.sentDay >= a.caps.daily;
              const active = activeAccount === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => pickAccount(a.id)}
                  role="radio"
                  aria-checked={active}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickAccount(a.id); } }}
                  title="Compte actif (utilisé par « Marquer envoyé »)"
                  className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                    active
                      ? "border-[var(--color-accent)] bg-[var(--color-surface)] shadow-[0_0_0_1px_var(--color-accent)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${active ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-strong)]"}`} />
                    <span className="font-semibold text-sm text-[var(--color-text-primary)] truncate">@{a.username}</span>
                    <span className={`text-[11px] font-medium rounded-md px-1.5 py-0.5 ${
                      a.status === "chaud"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : a.status === "pause"
                          ? "bg-slate-500/10 text-slate-500"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    }`}>
                      {a.status === "chaud" ? "Chaud" : a.status === "pause" ? "Pause" : `Chauffe J${a.caps.day}`}
                    </span>
                    <span className="flex-1" />
                    <select
                      value={a.status}
                      onChange={(e) => setAccountStatus(a.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="glass-input rounded-md px-1.5 py-0.5 text-[11px] font-medium cursor-pointer text-[var(--color-text-secondary)]"
                    >
                      <option value="warmup">chauffe</option>
                      <option value="chaud">chaud</option>
                      <option value="pause">pause</option>
                    </select>
                  </div>
                  <QuotaBar label="Jour" val={a.sentDay} cap={a.caps.daily} pct={dayPct} />
                  {full && <p className="mt-2 text-[11px] font-medium text-rose-600 dark:text-rose-400">Plafond jour atteint — stop jusqu'à demain 8 h.</p>}
                </div>
              );
            })}
            {/* Ajout de compte */}
            <div className="rounded-xl border border-dashed border-[var(--color-border-strong)] p-3.5 flex items-center gap-2">
              <input
                value={newAccount}
                onChange={(e) => setNewAccount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAccount()}
                placeholder="@compte_prospection"
                className="flex-1 glass-input rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none min-w-0"
              />
              <button
                onClick={addAccount}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg text-white bg-[var(--color-accent)] hover:opacity-90 transition-opacity cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
          </div>

          {/* Activité — bandeau discret jour / semaine / mois */}
          {stats && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 divide-y sm:divide-y-0 sm:divide-x xl:divide-x-0 xl:divide-y divide-[var(--color-border)]">
              {([
                ["Aujourd'hui", stats.day],
                ["Cette semaine", stats.week],
                ["Ce mois", stats.month],
              ] as const).map(([label, s]) => (
                <div key={label} className="px-4 py-3 flex items-baseline gap-2.5 min-w-0">
                  <span className="font-mono-num text-xl font-semibold text-[var(--color-text-primary)]">{s.sent}</span>
                  <span className="text-xs text-[var(--color-text-secondary)] truncate">
                    DM · {label.toLowerCase()}
                    <span className="text-[var(--color-text-muted)]"> — {s.m1} accroches, {s.relances} relances, {s.added} ajoutés</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* File de relances dues */}
          {due.length > 0 && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/25 bg-rose-50/60 dark:bg-rose-500/5 px-4 py-3">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-2">
                À relancer maintenant · {due.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {due.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSearchText(d.username);
                      setStatusFilter("all");
                      setTierFilter("all");
                      setQualifFilter("all");
                    }}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-[var(--color-surface)] border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 hover:border-rose-400 transition-colors cursor-pointer"
                    title={`Relance R${(d.followup_count ?? 0) + 1} · ${d.stage ? STAGE_LABEL[d.stage as Stage] ?? d.stage : "—"}`}
                  >
                    @{d.username} · R{(d.followup_count ?? 0) + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {cockpitMsg && <p className="text-sm text-[var(--color-text-secondary)]">{cockpitMsg}</p>}
        </section>

        {/* ─── LA LISTE DES PROSPECTS (du plus récent au plus ancien) ─── */}
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Prospects</h2>
            <p className="text-xs text-[var(--color-text-muted)]">du plus récent au plus ancien</p>
            <span className="flex-1" />
            <span className="text-xs text-[var(--color-text-muted)]">
              <span className="font-mono-num">{shown.length}</span> affichés
            </span>
          </div>

          {/* Filtres statut */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {(["all", "todo", "contacted", "positive", "negative"] as const).map((s) => {
              const active = statusFilter === s;
              const styles = STATUS_STYLES[s] ?? STATUS_STYLES.todo;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? s === "all"
                        ? "bg-[var(--color-text-primary)] text-[var(--color-background)] border-transparent"
                        : styles.pillActive
                      : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {s === "all" ? "Tous" : STATUS_LABEL[s]}
                  <span className={`ml-1.5 font-mono-num ${active ? "" : "text-[var(--color-text-muted)]"}`}>{counts[s] ?? 0}</span>
                </button>
              );
            })}
          </div>

          {/* Filtres secondaires : métier, priorité, verdict IA, sans site, recherche */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={metierFilter}
              onChange={(e) => setMetierFilter(e.target.value)}
              className="glass-input rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--color-text-primary)] outline-none cursor-pointer"
            >
              <option value="all">Métier : tous</option>
              {metiers.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="glass-input rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--color-text-primary)] outline-none cursor-pointer"
            >
              <option value="all">Priorité : toutes</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
            <select
              value={qualifFilter}
              onChange={(e) => setQualifFilter(e.target.value)}
              className="glass-input rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--color-text-primary)] outline-none cursor-pointer"
            >
              <option value="all">IA : tous</option>
              <option value="qualified">Qualifiés</option>
              <option value="borderline">Limites</option>
              <option value="rejected">Écartés</option>
              <option value="none">Pas encore triés</option>
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noSiteOnly}
                onChange={(e) => setNoSiteOnly(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              Sans site uniquement
            </label>
            <div className="flex-1 min-w-44">
              <div className="flex items-center glass-input rounded-lg px-3">
                <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Rechercher (pseudo, nom, ville, bio…)"
                  className="flex-1 bg-transparent border-none outline-none px-2 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
                />
              </div>
            </div>
          </div>

          {/* Liste */}
          {loading && leads.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <Loader2 className="w-7 h-7 text-[var(--color-text-muted)] mx-auto animate-spin opacity-50" />
            </div>
          ) : shown.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border-strong)]">
              <Search className="w-9 h-9 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
              <p className="text-[var(--color-text-secondary)] text-sm">
                Aucun prospect avec ces filtres.
              </p>
              <p className="text-[var(--color-text-muted)] text-xs mt-1">
                Élargis les filtres, ou déplie « Trouver de nouveaux prospects » en haut de page.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)] overflow-hidden">
              {shown.map((l) => {
                const link = origin ? `${origin}/di/${shortCode(l.id)}` : "";
                // Métier effectif : profession IA (précise) > redétection catégorie/pseudo/bio
                // (règles corrigées) > métier stocké au scan (peut être périmé).
                const metierEff =
                  detectMetier(l.profession_ia, null) ||
                  detectMetier(l.category, `${l.username} ${l.bio ?? ""}`) ||
                  l.metier ||
                  "";
                const trameSuggested = detectTrame(l.full_name, l.bio);
                const trame = trameChoice[l.id] ?? trameSuggested;
                const dmSteps = instagramDmSequence(
                  {
                    metier: metierEff,
                    ville: l.ville ?? "",
                    bookingPlatform: l.booking_platform,
                    firstName: l.full_name ? l.full_name.split(/\s+/)[0] : null,
                    professionIa: l.profession_ia,
                  },
                  link,
                  trame,
                );
                const dmExpanded = expandedDm === l.id;
                const sty = STATUS_STYLES[l.status] ?? STATUS_STYLES.todo;
                const qualif = l.qualification ? QUALIF_BADGE[l.qualification] : null;

                const tier = l.score_tier ? TIER_DOT[l.score_tier] ?? TIER_DOT.cold : null;
                const relanceDue =
                  l.next_followup_at && new Date(l.next_followup_at) <= new Date() &&
                  l.stage !== "call_booke" && l.stage !== "perdu";

                return (
                  <div key={l.id} className="p-4 sm:p-5 transition-colors hover:bg-[var(--color-surface-2)]/60">
                    {/* Top row: username + signaux + statut */}
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-x-2.5 gap-y-0.5 flex-wrap">
                          <a
                            href={`https://instagram.com/${l.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
                          >
                            @{l.username}
                          </a>
                          {l.full_name && (
                            <span className="text-sm text-[var(--color-text-secondary)]">{l.full_name}</span>
                          )}
                          {tier && (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tier.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
                              {tier.label}{typeof l.score === "number" ? <span className="font-mono-num"> {l.score}</span> : null}
                            </span>
                          )}
                          {qualif && (
                            <span className={`text-xs font-medium ${qualif.cls}`} title={l.qualification_reason ?? undefined}>
                              {qualif.label}
                            </span>
                          )}
                          {l.stage && (
                            <span className="text-xs font-medium rounded-md px-1.5 py-0.5 bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                              {STAGE_LABEL[l.stage as Stage] ?? l.stage}
                            </span>
                          )}
                          {relanceDue && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                              relance due
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-[var(--color-text-muted)]">
                          <span>{new Date(l.discovered_at).toLocaleDateString("fr-FR")}</span>
                          {l.followers != null && (
                            <span className="font-mono-num">· {l.followers.toLocaleString("fr-FR")} abonnés</span>
                          )}
                          {(l.profession_ia || l.metier) && <span>· {l.profession_ia || l.metier}</span>}
                          {l.ville && <span>· {l.ville}</span>}
                          {l.email && <span className="text-[var(--color-text-secondary)]">· {l.email}</span>}
                          {l.phone && <span className="text-[var(--color-text-secondary)]">· {l.phone}</span>}
                          {l.has_website === true && (
                            <span className="inline-flex items-center gap-0.5">· <ExternalLink className="w-3 h-3" /> a un site</span>
                          )}
                          {l.booking_platform && (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">· {l.booking_platform}</span>
                          )}
                          {l.hashtag_source && <span>· #{l.hashtag_source}</span>}
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs font-medium rounded-md px-2 py-0.5 border ${
                        l.status === statusFilter && statusFilter !== "all" ? sty.pillActive : sty.pill
                      }`}>
                        {STATUS_LABEL[l.status] ?? l.status}
                      </span>
                    </div>

                    {/* Bio */}
                    {l.bio && (
                      <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line mb-2.5 line-clamp-2 max-w-[75ch]">
                        {l.bio}
                      </p>
                    )}

                    {/* DM section — collapsible */}
                    <button
                      onClick={() => setExpandedDm(dmExpanded ? null : l.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors cursor-pointer mb-1.5 mr-4"
                    >
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${dmExpanded ? "rotate-90" : ""}`} />
                      Séquence DM
                      <span className="text-[var(--color-text-muted)] font-normal">· 9 étapes + relances</span>
                    </button>

                    {dmExpanded && (
                      <div className="mb-3 mt-1 animate-slide-up space-y-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-3.5">
                        {/* Choix de trame : solo (tutoiement) / entreprise (vouvoiement) */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Trame</span>
                          <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
                            {(["solo", "entreprise"] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => setTrameChoice((prev) => ({ ...prev, [l.id]: t }))}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                                  trame === t
                                    ? "bg-[var(--color-accent)] text-white"
                                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                }`}
                              >
                                {TRAME_LABEL[t]}
                                {t === trameSuggested ? " · suggérée" : ""}
                              </button>
                            ))}
                          </div>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            un message à la fois, jamais de lien avant M8 — varie les formulations
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                          {dmSteps.map((s) => {
                            const key = `${l.id}-${s.step}`;
                            const isRelance = s.step.startsWith("R");
                            return (
                              <div key={key} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span
                                    className={`font-mono-num text-[11px] font-semibold truncate ${isRelance ? "text-[var(--color-text-muted)]" : "text-[var(--color-accent)]"}`}
                                    title={s.title}
                                  >
                                    {s.step} <span className="font-sans font-normal text-[var(--color-text-muted)]">· {s.title}</span>
                                  </span>
                                  <span className="shrink-0 flex items-center gap-1">
                                    <button
                                      onClick={() => copy(key, s.text)}
                                      className="flex items-center gap-1 text-xs font-medium rounded-md px-1.5 py-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                                    >
                                      {copied === key ? (
                                        <><Check className="w-3 h-3 text-emerald-600" /> Copié</>
                                      ) : (
                                        <><Copy className="w-3 h-3" /> Copier</>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => markSent(l.id, s.step)}
                                      title={activeAccount ? "Journalise l'envoi (quota + stade + relance)" : "Sélectionne un compte actif dans le cockpit"}
                                      className="flex items-center gap-1 text-xs font-medium rounded-md px-1.5 py-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                                    >
                                      <Send className="w-3 h-3" /> Envoyé
                                    </button>
                                  </span>
                                </div>
                                <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-line leading-relaxed">
                                  {s.text}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Rapport concurrentiel — collapsible, chargé à la demande.
                        Sans ville détectée : on ne propose pas l'analyse (elle échouerait),
                        on offre un petit champ pour saisir la ville à la main. */}
                    {l.ville && l.ville.trim() ? (
                      <button
                        onClick={() => toggleCompetitors(l.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors cursor-pointer mb-1.5"
                      >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedComp === l.id ? "rotate-90" : ""}`} />
                        Rapport concurrentiel
                        <span className="text-[var(--color-text-muted)] font-normal">· classement Google + qui fait des ads</span>
                      </button>
                    ) : (
                      <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5" /> Rapport concurrentiel — ville manquante :
                        </span>
                        <input
                          value={villeInput[l.id] ?? ""}
                          onChange={(e) => setVilleInput((prev) => ({ ...prev, [l.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveVilleAndAnalyze(l.id); }}
                          placeholder="Ville…"
                          className="glass-input rounded-lg px-2 py-1 text-xs w-32"
                        />
                        <button
                          onClick={() => saveVilleAndAnalyze(l.id)}
                          disabled={!(villeInput[l.id] ?? "").trim()}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Analyser
                        </button>
                      </div>
                    )}

                    {expandedComp === l.id && (
                      <div className="mb-3 mt-1 animate-slide-up rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-3.5">
                        {compLoading === l.id && (
                          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] py-1">
                            <Loader2 className="w-4 h-4 animate-spin" /> Analyse Google Maps en cours (~30 s)…
                          </div>
                        )}
                        {compError[l.id] && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 py-1">{compError[l.id]}</p>
                        )}
                        {compReports[l.id] && (() => {
                          const r = compReports[l.id];
                          return (
                            <div className="space-y-2.5">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  {r.selfRank
                                    ? <>#{r.selfRank}/{r.total} sur « {r.metier} {r.ville} »</>
                                    : <>Absent du top {r.total} sur « {r.metier} {r.ville} »</>}
                                </span>
                                <span className="font-medium text-[var(--color-text-secondary)]">
                                  {r.adsCount}/{r.total} font des ads{r.sponsoredCount ? ` (dont ${r.sponsoredCount} sponsorisés)` : ""}
                                </span>
                                <span className="flex-1" />
                                <button
                                  onClick={() =>
                                    copy(
                                      `hook-${l.id}`,
                                      competitorHook({
                                        metier: r.metier,
                                        ville: r.ville,
                                        selfRank: r.selfRank,
                                        adsCount: r.adsCount,
                                        firstName: l.full_name ? l.full_name.split(/\s+/)[0] : null,
                                        trame,
                                      }),
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
                                >
                                  {copied === `hook-${l.id}` ? (
                                    <><Check className="w-3 h-3" /> Accroche copiée</>
                                  ) : (
                                    <><Copy className="w-3 h-3" /> Copier l'accroche DM</>
                                  )}
                                </button>
                              </div>
                              <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
                                {r.competitors.map((c) => (
                                  <div
                                    key={c.rank}
                                    className={`flex items-center gap-2.5 text-xs px-2.5 py-1.5 ${c.isSelf ? "bg-[var(--color-accent-soft)] font-medium" : ""}`}
                                  >
                                    <span className="w-7 shrink-0 font-mono-num text-[var(--color-text-muted)]">#{c.rank}</span>
                                    <span className={`w-9 shrink-0 text-center text-[11px] font-medium rounded px-1 py-px ${
                                      c.ads === "sponso"
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                        : c.ads === "tag"
                                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                        : "text-[var(--color-text-muted)]"
                                    }`} title={c.ads === "sponso" ? "Annonce sponsorisée Maps (paie des ads en direct)" : c.ads === "tag" ? "Tag de conversion Google Ads détecté sur son site" : "Aucun signal d'ads"}>
                                      {c.ads === "sponso" ? "Ads" : c.ads === "tag" ? "ads?" : "—"}
                                    </span>
                                    <span className="truncate flex-1 text-[var(--color-text-primary)]">{c.name}{c.isSelf ? " ← lui" : ""}</span>
                                    {c.rating != null && (
                                      <span className="shrink-0 text-[var(--color-text-muted)] font-mono-num">{c.rating}★ {c.reviews ?? 0}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2.5 mt-1 border-t border-[var(--color-border)]">
                      <a
                        href={`https://instagram.com/${l.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity no-underline"
                      >
                        <Send className="w-3 h-3" />
                        Ouvrir le DM
                      </a>
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors no-underline"
                        >
                          <Eye className="w-3 h-3" />
                          Aperçu
                        </a>
                      )}
                      {l.status === "contacted" && l.stage !== "call_booke" && l.stage !== "perdu" && (
                        <button
                          onClick={() => markSeen(l.id)}
                          title="Il a vu sans répondre → programme la relance (R1 +1 h, R2 +7 h…)"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Vu sans réponse
                        </button>
                      )}
                      {l.stage !== "call_booke" && (
                        <button
                          onClick={() => setStage(l.id, "call_booke")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                        >
                          <PhoneCall className="w-3 h-3" /> Call booké
                        </button>
                      )}
                      {l.stage !== "perdu" && (
                        <button
                          onClick={() => setStage(l.id, "perdu")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3 h-3" /> Perdu
                        </button>
                      )}
                      <span className="flex-1" />
                      <span className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
                        {(["contacted", "positive", "negative"] as const).map((s) => {
                          const active = l.status === s;
                          const activeCls =
                            s === "positive"
                              ? "bg-emerald-600 text-white"
                              : s === "negative"
                                ? "bg-rose-600 text-white"
                                : "bg-blue-600 text-white";
                          return (
                            <button
                              key={s}
                              onClick={() => setStatus(l.id, s)}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                                active ? activeCls : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                              }`}
                            >
                              {STATUS_LABEL[s]}
                            </button>
                          );
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}

/** Jauge de quota (heure / jour) — verte → ambre (80 %) → rouge (100 %). */
function QuotaBar({ label, val, cap, pct }: { label: string; val: number; cap: number; pct: number }) {
  const color = pct >= 100 ? "#f43f5e" : pct >= 80 ? "#f59e0b" : "#10b981";
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[10px] font-semibold text-[var(--color-text-muted)]">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <span className="w-12 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[var(--color-text-secondary)]">
        {val}/{cap}
      </span>
    </div>
  );
}
