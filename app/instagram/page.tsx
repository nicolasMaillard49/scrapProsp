"use client";

// Page unique de prospection Instagram :
//  - EN HAUT : l'outil (génération de hashtags, scan Apify, qualification IA, exports)
//  - EN DESSOUS : la liste des prospects obtenus, du plus récent au plus ancien,
//    avec filtres statut (contacté ou pas…), métier, priorité (score), verdict IA, sans site.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Copy, Check, ExternalLink, Send, Eye, Users, Loader2, ArrowLeft, Gauge, Bell, Plus, PhoneCall, XCircle } from "lucide-react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { instagramDmSequence } from "@/app/lib/instagram";
import { STAGE_LABEL, type Stage } from "@/app/lib/igPipeline";
import { shortCode } from "@/app/lib/links";
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
  caps: { hourly: number; daily: number; day: number };
  sentHour: number;
  sentDay: number;
}

interface DueFollowup {
  id: string;
  username: string;
  stage: string | null;
  followup_count: number;
  next_followup_at: string;
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

const TIER_BADGE: Record<string, string> = {
  hot: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  warm: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  cold: "bg-slate-500/10 text-slate-500 border-slate-400/30",
};

const QUALIF_BADGE: Record<string, { label: string; cls: string }> = {
  qualified: { label: "✓ Qualifié IA", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  borderline: { label: "~ Limite", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  rejected: { label: "✗ Écarté IA", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" },
};

export default function InstagramPage() {
  const [leads, setLeads] = useState<IgLead[]>([]);
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

  // ── Cockpit (comptes émetteurs, quotas, relances) ──
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [due, setDue] = useState<DueFollowup[]>([]);
  const [activeAccount, setActiveAccount] = useState<string>("");
  const [newAccount, setNewAccount] = useState("");
  const [cockpitMsg, setCockpitMsg] = useState<string | null>(null);

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
    setCockpitMsg(`Compte @${username} ajouté (chauffe J1 : 5/h · 15/j).`);
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
                Hashtags → scan → qualification IA → DM. La liste des prospects est en dessous.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
            <Users className="w-4 h-4" />
            <span className="font-mono-num">{leads.length}</span>
            <span className="hidden sm:inline">prospects</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ─── L'OUTIL DE PROSPECTION (en haut) ─── */}
        <ProspectionTool onDataChanged={loadLeads} />

        {/* ─── COCKPIT D'ENVOI (comptes, quotas, relances) ─── */}
        <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Gauge className="w-4 h-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Cockpit d'envoi</h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              envoi 100 % manuel — l'outil trace, compte les quotas et programme les relances
            </span>
            <span className="flex-1" />
            <button
              onClick={sendDigest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" /> Récap Telegram
            </button>
          </div>

          {/* Comptes émetteurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((a) => {
              const dayPct = a.caps.daily ? Math.min(100, (a.sentDay / a.caps.daily) * 100) : 100;
              const hourPct = a.caps.hourly ? Math.min(100, (a.sentHour / a.caps.hourly) * 100) : 100;
              const full = a.caps.daily > 0 && a.sentDay >= a.caps.daily;
              const active = activeAccount === a.id;
              return (
                <div
                  key={a.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    active ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]" : "border-[var(--color-border)]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      name="activeAccount"
                      checked={active}
                      onChange={() => pickAccount(a.id)}
                      className="accent-[var(--color-accent)] cursor-pointer"
                      title="Compte actif (utilisé par « Marquer envoyé »)"
                    />
                    <span className="font-bold text-sm text-[var(--color-text-primary)]">@{a.username}</span>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                      a.status === "chaud"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : a.status === "pause"
                          ? "bg-slate-500/10 text-slate-500"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}>
                      {a.status === "chaud" ? "CHAUD" : a.status === "pause" ? "PAUSE" : `CHAUFFE J${a.caps.day}`}
                    </span>
                    <span className="flex-1" />
                    <select
                      value={a.status}
                      onChange={(e) => setAccountStatus(a.id, e.target.value)}
                      className="glass-input rounded px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer text-[var(--color-text-secondary)]"
                    >
                      <option value="warmup">chauffe</option>
                      <option value="chaud">chaud</option>
                      <option value="pause">pause</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <QuotaBar label="Heure" val={a.sentHour} cap={a.caps.hourly} pct={hourPct} />
                    <QuotaBar label="Jour" val={a.sentDay} cap={a.caps.daily} pct={dayPct} />
                  </div>
                  {full && <p className="mt-1.5 text-[11px] font-semibold text-rose-500">Plafond jour atteint — stop jusqu'à demain 8 h.</p>}
                </div>
              );
            })}
            {/* Ajout de compte */}
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-3 flex items-center gap-2">
              <input
                value={newAccount}
                onChange={(e) => setNewAccount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAccount()}
                placeholder="@compte_prospection"
                className="flex-1 glass-input rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none min-w-0"
              />
              <button
                onClick={addAccount}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-[var(--color-accent)] hover:opacity-90 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
          </div>

          {/* File de relances dues */}
          {due.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-bold text-[var(--color-text-primary)] mb-1.5">
                🔁 À relancer maintenant ({due.length})
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
                    className="px-2.5 py-1 text-xs font-semibold rounded-full border border-rose-400/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
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

        {/* ─── LA LISTE DES PROSPECTS (en dessous, du plus récent au plus ancien) ─── */}
        <div className="pt-2 border-t-2 border-[var(--color-border)]">
          <h2 className="text-base font-bold text-[var(--color-text-primary)] mt-4 mb-3">
            Prospects obtenus <span className="text-sm font-normal text-[var(--color-text-muted)]">— du plus récent au plus ancien</span>
          </h2>

          {/* Filtres statut */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 mb-3">
            {(["all", "todo", "contacted", "positive", "negative"] as const).map((s) => {
              const active = statusFilter === s;
              const styles = STATUS_STYLES[s] ?? STATUS_STYLES.todo;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
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

          {/* Filtres secondaires : métier, priorité, verdict IA, sans site, recherche */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select
              value={metierFilter}
              onChange={(e) => setMetierFilter(e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] outline-none cursor-pointer"
            >
              <option value="all">Métier : tous</option>
              {metiers.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] outline-none cursor-pointer"
            >
              <option value="all">Priorité : toutes</option>
              <option value="hot">🔥 Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
            <select
              value={qualifFilter}
              onChange={(e) => setQualifFilter(e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] outline-none cursor-pointer"
            >
              <option value="all">IA : tous</option>
              <option value="qualified">✓ Qualifiés</option>
              <option value="borderline">~ Limites</option>
              <option value="rejected">✗ Écartés</option>
              <option value="none">Pas encore triés</option>
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={noSiteOnly}
                onChange={(e) => setNoSiteOnly(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              Sans site uniquement
            </label>
            <div className="flex-1 min-w-40">
              <div className="flex items-center glass-input rounded-lg px-3">
                <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Rechercher (pseudo, nom, ville, bio…)"
                  className="flex-1 bg-transparent border-none outline-none px-2 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                />
              </div>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] font-mono-num">{shown.length} affichés</span>
          </div>

          {/* Liste */}
          {loading && leads.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-2xl">
              <Loader2 className="w-8 h-8 text-[var(--color-text-muted)] mx-auto animate-spin opacity-50" />
            </div>
          ) : shown.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-2xl border-dashed">
              <Search className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
              <p className="text-[var(--color-text-muted)] text-sm">
                Aucun prospect avec ces filtres. Lance une prospection ci-dessus.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {shown.map((l) => {
                const link = origin ? `${origin}/di/${shortCode(l.id)}` : "";
                const dmSteps = instagramDmSequence(
                  {
                    metier: l.metier ?? "",
                    ville: l.ville ?? "",
                    bookingPlatform: l.booking_platform,
                    firstName: l.full_name ? l.full_name.split(/\s+/)[0] : null,
                    professionIa: l.profession_ia,
                  },
                  link,
                );
                const dmExpanded = expandedDm === l.id;
                const sty = STATUS_STYLES[l.status] ?? STATUS_STYLES.todo;
                const qualif = l.qualification ? QUALIF_BADGE[l.qualification] : null;

                return (
                  <div key={l.id} className="glass-card rounded-2xl p-4 sm:p-5 animate-fade-in">
                    {/* Top row: username + badges + statut */}
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
                          {l.score_tier && (
                            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${TIER_BADGE[l.score_tier] ?? TIER_BADGE.cold}`}>
                              {l.score_tier === "hot" ? "🔥 HOT" : l.score_tier.toUpperCase()}{typeof l.score === "number" ? ` ${l.score}` : ""}
                            </span>
                          )}
                          {qualif && (
                            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${qualif.cls}`} title={l.qualification_reason ?? undefined}>
                              {qualif.label}
                            </span>
                          )}
                          {l.stage && (
                            <span className="text-[10px] font-bold rounded-full px-2 py-0.5 border border-[var(--color-accent)]/40 text-[var(--color-accent)]">
                              {STAGE_LABEL[l.stage as Stage] ?? l.stage}
                            </span>
                          )}
                          {l.next_followup_at && new Date(l.next_followup_at) <= new Date() && l.stage !== "call_booke" && l.stage !== "perdu" && (
                            <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                              🔁 relance due
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-[var(--color-text-muted)]">
                          <span>{new Date(l.discovered_at).toLocaleDateString("fr-FR")}</span>
                          {l.followers != null && (
                            <span className="font-mono-num">· {l.followers.toLocaleString("fr-FR")} abonnes</span>
                          )}
                          {(l.profession_ia || l.metier) && <span>· {l.profession_ia || l.metier}</span>}
                          {l.ville && <span>· {l.ville}</span>}
                          {l.email && <span className="text-emerald-600 dark:text-emerald-400">· {l.email}</span>}
                          {l.phone && <span className="text-emerald-600 dark:text-emerald-400">· {l.phone}</span>}
                          {l.has_website === true && (
                            <span className="inline-flex items-center gap-0.5">· <ExternalLink className="w-3 h-3" /> a un site</span>
                          )}
                          {l.booking_platform && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">· {l.booking_platform}</span>
                          )}
                          {l.hashtag_source && <span>· #{l.hashtag_source}</span>}
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs font-bold rounded-full px-2.5 py-0.5 border ${
                        l.status === statusFilter && statusFilter !== "all" ? sty.pillActive : sty.pill
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
                      {dmExpanded ? "Masquer la séquence DM" : "Voir la séquence DM (trame en 9 étapes + relances)"}
                    </button>

                    {dmExpanded && (
                      <div className="mb-3 animate-slide-up space-y-2">
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          Envoie les messages <b>un par un</b> selon ses réponses (jamais de pavé, jamais de lien avant M8).
                          Max 15 DM/h, 60/j — varie les formulations.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                          {dmSteps.map((s) => {
                            const key = `${l.id}-${s.step}`;
                            const isRelance = s.step.startsWith("R");
                            return (
                              <div key={key} className="glass-input rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider truncate" title={s.title}
                                    style={{ color: isRelance ? "var(--color-text-muted)" : "var(--color-accent)" }}>
                                    {s.step} · {s.title}
                                  </span>
                                  <span className="shrink-0 flex items-center gap-2">
                                    <button
                                      onClick={() => copy(key, s.text)}
                                      className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:opacity-80 transition cursor-pointer"
                                    >
                                      {copied === key ? (
                                        <><Check className="w-3 h-3" /> Copie</>
                                      ) : (
                                        <><Copy className="w-3 h-3" /> Copier</>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => markSent(l.id, s.step)}
                                      title={activeAccount ? "Journalise l'envoi (quota + stade + relance)" : "Sélectionne un compte actif dans le cockpit"}
                                      className="flex items-center gap-1 text-xs font-semibold rounded px-1.5 py-0.5 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                                    >
                                      <Send className="w-3 h-3" /> Envoyé ✓
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
                      {l.status === "contacted" && l.stage !== "call_booke" && l.stage !== "perdu" && (
                        <button
                          onClick={() => markSeen(l.id)}
                          title="Il a vu sans répondre → programme la relance (R1 +1 h, R2 +7 h…)"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Vu sans réponse
                        </button>
                      )}
                      {l.stage !== "call_booke" && (
                        <button
                          onClick={() => setStage(l.id, "call_booke")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                        >
                          <PhoneCall className="w-3 h-3" /> Call booké
                        </button>
                      )}
                      {l.stage !== "perdu" && (
                        <button
                          onClick={() => setStage(l.id, "perdu")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        >
                          <XCircle className="w-3 h-3" /> Perdu
                        </button>
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
