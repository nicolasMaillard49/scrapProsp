"use client";

// Page unique de prospection Instagram :
//  - EN HAUT : l'outil (génération de hashtags, scan Apify, qualification IA, exports)
//  - EN DESSOUS : la liste des prospects obtenus, du plus récent au plus ancien,
//    avec filtres statut (contacté ou pas…), métier, priorité (score), verdict IA, sans site.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, Copy, Check, ExternalLink, Send, Eye, Loader2, ArrowLeft, Gauge, Bell, Plus, PhoneCall, XCircle, ChevronRight, ChevronLeft, Hash, AlertTriangle, Shuffle, RotateCw, Zap, Trash2, Users, LayoutGrid, List as ListIcon, Clock, StickyNote, MessageSquareReply, GripVertical, Target } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { instagramDmSequence, detectMetier, firstNameOf, competitorHook } from "@/app/lib/instagram";
import { STAGE_LABEL, STAGE_SHORT, STAGES, stageTone, type Stage, type StageTone } from "@/app/lib/igPipeline";
import { shortCode } from "@/app/lib/links";
import type { IgCompetitorReport } from "@/app/lib/igCompetitor";
import ProspectionTool from "./ProspectionTool";
import PerformanceMenu from "./PerformanceMenu";
import ReplyButton from "./ReplyButton";

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
  /** Réponses entrantes journalisées (migration 018) — null si la colonne n'existe pas encore. */
  reply_count: number | null;
  first_reply_at: string | null;
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

interface StreakInfo {
  current: number;
  best: number;
  todayDone: boolean;
}

interface Engagement {
  repliesToday: number;
  conversations: number;
  callsBooked: number;
}

type ViewMode = "selection" | "list" | "pipeline";

/** Une ligne de la sélection du jour (GET /api/instagram/selection). */
interface SelectionRow {
  prospect_id: string;
  rank: number;
  first_day: string;
  carry_count: number;
  done_at: string | null;
  skipped_at: string | null;
  skip_reason: string | null;
  prospect: IgLead;
}

interface DailySelection {
  day: string;
  accountId: string;
  /** Créneaux d'accroche du jour = plafond de chauffe − relances dues. */
  slots: number;
  rows: SelectionRow[];
  carried: number;
  /** Créneaux non pourvus faute de stock qualifié → bouton « Aller en chercher ». */
  shortfall: number;
  stockLeft: number;
}

/** Cible quotidienne de réponses reçues — 2ᵉ objectif (qualité) à côté des M1 (volume). */
const REPLY_GOAL = 5;

const STATUS_LABEL: Record<string, string> = {
  todo: "A contacter",
  contacted: "Contacte",
  positive: "Positif",
  negative: "Negatif",
};

/**
 * Colonnes chargées pour la liste = uniquement celles affichées (interface IgLead).
 * On EXCLUT surtout `raw` (dump Apify ~80 Ko/ligne) et `profile_pic_url` : `select("*")`
 * tirait 36 Mo pour 673 prospects (~11 s → statement timeout). Ce set fait ~0,5 s / 0,5 Mo.
 */
const PROSPECT_COLUMNS =
  "id,username,full_name,bio,external_url,followers,category,metier,ville,booking_platform,hashtag_source,status,notes,discovered_at,email,phone,has_website,score,score_tier,qualification,qualification_reason,profession_ia,last_post_at,stage,followup_count,next_followup_at,contacted_by,reply_count,first_reply_at";

/**
 * Nom d'onglet FIXE pour Instagram : chaque ouverture réutilise le même onglet
 * (au lieu d'en empiler un nouveau à chaque prospect → Chrome saturé). `target`
 * sur les liens + 2e argument de window.open.
 */
const INSTA_TAB = "nmf_insta";

/**
 * Plafond d'abonnés : on ne démarche plus les comptes > 15 000 abonnés (trop gros,
 * mauvais taux de réponse). Filtre DUR appliqué partout (liste + pipeline + compteurs).
 */
const MAX_FOLLOWERS = 15000;

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

/* Teinte des colonnes du pipeline par stade (rail d'en-tête + texte du titre). */
const TONE_STYLES: Record<StageTone, { rail: string; text: string }> = {
  todo: { rail: "bg-slate-300 dark:bg-slate-600", text: "text-slate-600 dark:text-slate-300" },
  cold: { rail: "bg-sky-400", text: "text-sky-700 dark:text-sky-400" },
  progress: { rail: "bg-blue-500", text: "text-blue-700 dark:text-blue-400" },
  warm: { rail: "bg-violet-500", text: "text-violet-700 dark:text-violet-400" },
  won: { rail: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  lost: { rail: "bg-slate-300 dark:bg-slate-600", text: "text-[var(--color-text-muted)]" },
};

/** Colonnes du pipeline : file « À contacter » (stade nul) + les 8 stades. */
const PIPE_COLS: { key: string; label: string; tone: StageTone }[] = [
  { key: "todo", label: "À contacter", tone: "todo" },
  ...STAGES.map((s) => ({ key: s, label: STAGE_SHORT[s], tone: stageTone(s) })),
];

export default function InstagramPage() {
  const [leads, setLeads] = useState<IgLead[]>([]);
  // Le scraper sert quelques fois par semaine ; la file d'envoi sert tous les
  // jours → l'outil est replié par défaut pour laisser le cockpit en tête.
  const [toolOpen, setToolOpen] = useState(false);
  // La prospection commence par « À contacter » : c'est la file du jour.
  const [statusFilter, setStatusFilter] = useState<string>("todo");
  const [metierFilter, setMetierFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [qualifFilter, setQualifFilter] = useState<string>("all");
  const [noSiteOnly, setNoSiteOnly] = useState(false);
  // Filtre par nombre d'abonnés (chaînes : "" = pas de borne).
  const [followersMin, setFollowersMin] = useState("");
  const [followersMax, setFollowersMax] = useState("");
  const [searchText, setSearchText] = useState("");
  // Suppression d'un lead non pertinent — confirmation en 2 temps (id en attente).
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Premier chargement terminé ? Tant que non, on évite d'afficher un « 0 »
  // trompeur dans l'en-tête. `loadError` remonte une panne au lieu de la taire.
  const [firstLoaded, setFirstLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Cockpit replié par défaut sur mobile (la file d'abord) ; toujours ouvert ≥ xl.
  const [cockpitOpen, setCockpitOpen] = useState(false);
  // Ordre : « recent » (défaut), « followers » (abonnés décroissants) ou « random ».
  // Le seed rend le mélange STABLE entre deux rendus (sinon la liste sauterait sans cesse).
  const [orderMode, setOrderMode] = useState<"recent" | "followers" | "random">("recent");
  const [shuffleSeed, setShuffleSeed] = useState(1);
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
  // ── Gamification : objectif du jour + série (streak) ──
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [dailyGoal, setDailyGoal] = useState(20);
  const [celebrate, setCelebrate] = useState(false);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  // Vue : « selection » (les N comptes du jour), « list » (fiche détaillée)
  // ou « pipeline » (colonnes par stade). La sélection du jour est la vue par
  // défaut : c'est elle qui remplace le tri manuel de la liste infinie.
  const [viewMode, setViewMode] = useState<ViewMode>("selection");
  const [selection, setSelection] = useState<DailySelection | null>(null);
  const [selLoading, setSelLoading] = useState(false);
  const [selMsg, setSelMsg] = useState<string | null>(null);
  const [refilling, setRefilling] = useState(false);
  // Filtre par stade (vue liste) — le stade est l'axe de suivi.
  const [stageFilter, setStageFilter] = useState<string>("all");
  // Carte en cours de glisser-déposer (pour l'aperçu DragOverlay).
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  // Cockpit replié sur PC (≥ xl) pour donner toute la largeur au pipeline.
  const [cockpitCollapsed, setCockpitCollapsed] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setActiveAccount(localStorage.getItem("ig_active_account") ?? "");
    const savedOrder = localStorage.getItem("ig_order_mode");
    if (savedOrder === "random") {
      setOrderMode("random");
      setShuffleSeed(Math.floor(Math.random() * 1e9) + 1);
    } else if (savedOrder === "followers") {
      setOrderMode("followers");
    }
    const savedGoal = parseInt(localStorage.getItem("ig_daily_goal") ?? "", 10);
    if (Number.isFinite(savedGoal) && savedGoal >= 5) setDailyGoal(savedGoal);
    const savedView = localStorage.getItem("ig_view_mode");
    if (savedView === "pipeline" || savedView === "list") setViewMode(savedView);
    if (localStorage.getItem("ig_cockpit_collapsed") === "1") setCockpitCollapsed(true);
  }, []);

  /** Ajuste l'objectif quotidien (bornes 5–60), mémorisé. */
  const changeGoal = useCallback((delta: number) => {
    setDailyGoal((g) => {
      const next = Math.max(5, Math.min(60, g + delta));
      localStorage.setItem("ig_daily_goal", String(next));
      return next;
    });
  }, []);

  // Bascule Récents / Aléatoire — mémorisée, et (re)tire un seed frais à chaque
  // passage en aléatoire ou clic « Mélanger ».
  const reshuffle = useCallback(() => setShuffleSeed(Math.floor(Math.random() * 1e9) + 1), []);
  const setOrder = useCallback((mode: "recent" | "followers" | "random") => {
    setOrderMode(mode);
    localStorage.setItem("ig_order_mode", mode);
    if (mode === "random") setShuffleSeed(Math.floor(Math.random() * 1e9) + 1);
  }, []);

  const setView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("ig_view_mode", mode);
  }, []);

  /**
   * Sélection du jour. Le GET la CRÉE si elle n'existe pas encore (report des
   * non-traités d'hier + complétion) — aucun appel externe, donc ouvrir la page
   * ne déclenche jamais de dépense Apify.
   */
  const loadSelection = useCallback(async () => {
    setSelLoading(true);
    try {
      const url = activeAccount
        ? `/api/instagram/selection?account_id=${encodeURIComponent(activeAccount)}`
        : "/api/instagram/selection";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        setSelection(null);
        setSelMsg(json.error ?? `Erreur ${res.status}`);
        return;
      }
      setSelection(json as DailySelection);
      setSelMsg(null);
    } catch (e) {
      setSelMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSelLoading(false);
    }
  }, [activeAccount]);

  /** Écarte un prospect de la sélection — il ne sera pas reporté demain. */
  const skipFromSelection = useCallback(
    async (prospectId: string) => {
      const res = await fetch("/api/instagram/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip", prospect_id: prospectId, account_id: activeAccount || undefined }),
      });
      const json = await res.json();
      if (res.ok) setSelection(json.selection as DailySelection);
      else setSelMsg(json.error ?? `Erreur ${res.status}`);
    },
    [activeAccount],
  );

  /** Stock épuisé → scan d'un hashtag jamais utilisé + qualification IA, puis complétion. */
  const refillSelection = useCallback(async () => {
    setRefilling(true);
    setSelMsg("Chasse en cours : scan d'un nouveau hashtag puis qualification IA…");
    try {
      const res = await fetch("/api/instagram/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refill", account_id: activeAccount || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSelMsg(json.error ?? `Erreur ${res.status}`);
        return;
      }
      setSelection(json.selection as DailySelection);
      const r = json.refill as {
        ran: boolean;
        mode?: "qualify" | "scan";
        reason?: string;
        hashtag?: string;
        metier?: string;
        inserted?: number;
        processed?: number;
        qualified?: number;
      };
      setSelMsg(
        !r.ran
          ? `Rien à faire — ${r.reason}`
          : r.mode === "qualify"
            ? `Tri IA du stock ${r.metier} : ${r.processed} comptes passés en revue, ${r.qualified} retenus.`
            : `#${r.hashtag} (${r.metier}) : ${r.inserted} nouveaux comptes scrapés, ${r.qualified} retenus par l'IA.`,
      );
    } catch (e) {
      setSelMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRefilling(false);
    }
  }, [activeAccount]);

  const loadCockpit = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/accounts");
      if (!res.ok) return;
      const json = await res.json();
      setAccounts(json.accounts ?? []);
      setDue(json.due ?? []);
      setStats(json.stats ?? null);
      setStreak(json.streak ?? null);
      setEngagement(json.engagement ?? null);
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    loadCockpit();
  }, [loadCockpit]);

  useEffect(() => {
    loadSelection();
  }, [loadSelection]);

  const pickAccount = useCallback((id: string) => {
    setActiveAccount(id);
    localStorage.setItem("ig_active_account", id);
  }, []);

  /**
   * Ouvre Instagram en RÉUTILISANT le même onglet. Le `target` nommé ne suffit pas :
   * le SPA d'Instagram réécrit `window.name`, si bien que le navigateur ne retrouve
   * plus l'onglet et en ouvre un neuf à chaque fois. On garde donc une référence
   * directe à la fenêtre (WindowProxy) et on la re-navigue (autorisé cross-origin).
   */
  const instaWin = useRef<Window | null>(null);
  const openInsta = useCallback((username: string) => {
    const url = `https://instagram.com/${username}`;
    const w = instaWin.current;
    try {
      if (w && !w.closed) {
        w.location.href = url;
        w.focus();
        return;
      }
    } catch {
      /* fenêtre invalide → on en rouvre une */
    }
    instaWin.current = window.open(url, INSTA_TAB);
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

  /**
   * One-tap « Prendre contact » (surtout mobile) : copie le M1, ouvre le profil
   * Instagram, et journalise l'envoi de M1 → statut « contacté » + KPI + quota +
   * stade. Le compte émetteur est auto-résolu (actif si valide, sinon 1er compte
   * non-en-pause sous son plafond jour). Les appels presse-papier / window.open
   * restent SYNCHRONES dans le geste utilisateur (obligatoire sur mobile).
   */
  const quickContact = useCallback(
    async (l: IgLead, m1text: string) => {
      // 1) presse-papier (dans le geste)
      if (m1text) {
        navigator.clipboard
          .writeText(m1text)
          .then(() => {
            setCopied(`quick-${l.id}`);
            setTimeout(() => setCopied((c) => (c === `quick-${l.id}` ? null : c)), 1600);
          })
          .catch(() => {});
      }
      // 2) ouvre le profil Instagram DANS L'ONGLET RÉUTILISÉ (dans le geste)
      openInsta(l.username);
      // 3) résout un compte émetteur valide (actif prioritaire, sinon 1er dispo)
      const isValid = (a: IgAccount) => a.status !== "pause" && a.caps.daily > 0 && a.sentDay < a.caps.daily;
      const accId =
        (activeAccount && accounts.some((a) => a.id === activeAccount && isValid(a)) ? activeAccount : null) ??
        accounts.find(isValid)?.id ??
        "";
      if (!accId) {
        setCockpitMsg(
          "M1 copié et Instagram ouvert — mais aucun compte émetteur disponible pour marquer « contacté » (ajoute/active un compte, ou plafond jour atteint).",
        );
        return;
      }
      // 4) journalise M1 → contacté + KPI + quota
      const res = await fetch("/api/instagram/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: l.id, account_id: accId, step: "M1" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCockpitMsg(json.error ?? `Erreur ${res.status}`);
        return;
      }
      setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, ...json.prospect } : x)));
      const acc = accounts.find((a) => a.id === accId);
      setCockpitMsg(
        `@${l.username} contacté${acc ? ` via @${acc.username} (${json.counters.day}/${json.counters.caps.daily} aujourd'hui)` : ""} — M1 copié.`,
      );
      // Le M1 solde la ligne côté serveur : on relit la sélection pour la voir se vider.
      await Promise.all([loadCockpit(), loadSelection()]);
    },
    [activeAccount, accounts, loadCockpit, loadSelection, openInsta],
  );

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

  /** Transition manuelle du pipeline (call booké / perdu, ou déplacement drag-and-drop). */
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

  // ── Glisser-déposer du pipeline (souris ET tactile via dnd-kit) ──
  // PointerSensor : seuil de 6 px → un clic sur un bouton/lien reste un clic.
  // TouchSensor : appui long 200 ms → le scroll de la colonne reste possible au doigt.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const onDragStart = useCallback((e: DragStartEvent) => setActiveDrag(String(e.active.id)), []);
  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDrag(null);
      const overId = e.over?.id ? String(e.over.id) : null;
      const activeId = String(e.active.id);
      // « À contacter » (stade nul) n'est pas une cible ; sinon on déplace vers le stade
      // de la colonne — dans les DEUX sens (avancer comme reculer un prospect).
      if (!overId || overId === "todo") return;
      setStage(activeId, overId as Stage);
    },
    [setStage],
  );
  const toggleCockpit = useCallback(() => {
    setCockpitCollapsed((c) => {
      const next = !c;
      localStorage.setItem("ig_cockpit_collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

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
  // Toute panne est remontée dans `loadError` (plus de « 0 » silencieux).
  const loadLeads = useCallback(async () => {
    if (!supabaseConfigured) {
      // Cause n°1 d'un « 0 prospects » : les clés NEXT_PUBLIC_SUPABASE_* sont
      // figées dans le build. Un `npm start` sur un build périmé sert des clés
      // absentes/anciennes. → rebuild, ou lancer en `npm run dev`.
      setLoadError(
        "Connexion Supabase non configurée dans ce build. Reconstruis l'app (npm run build) puis relance, ou lance-la en développement (npm run dev).",
      );
      setFirstLoaded(true);
      return;
    }
    setLoading(true);
    // Jusqu'à 3 tentatives avec backoff : Supabase (free) peut sortir de veille
    // ou dépasser le statement_timeout au 1er appel — le 2e passe presque toujours.
    let lastErr: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from("instagram_prospects")
        .select(PROSPECT_COLUMNS)
        .order("discovered_at", { ascending: false })
        .limit(2000);
      if (!error) {
        setLoadError(null);
        setLeads((data ?? []) as IgLead[]);
        setFirstLoaded(true);
        setLoading(false);
        return;
      }
      lastErr = error.message;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
    setLoadError(`Lecture des prospects impossible : ${lastErr}`);
    setFirstLoaded(true);
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

  /** Enregistre une note prospect (sauvegarde au blur du champ inline). */
  const saveNote = useCallback(async (id: string, notes: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, notes } : l)));
    await fetch(`/api/instagram/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
  }, []);

  /** Supprime définitivement un lead non pertinent (base + état local). */
  const deleteLead = useCallback(async (id: string) => {
    const res = await fetch(`/api/instagram/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setConfirmDelete(null);
    } else {
      const j = await res.json().catch(() => ({}));
      setCockpitMsg(j.error ?? `Suppression impossible (${res.status})`);
    }
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

  // Filtres SECONDAIRES (métier, priorité, IA, sans site, abonnés, recherche) —
  // TOUT sauf le statut. Sert de base aux pastilles de statut ET à la liste.
  const baseFiltered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const min = followersMin ? parseInt(followersMin, 10) : null;
    const max = followersMax ? parseInt(followersMax, 10) : null;
    return leads.filter((l) => {
      if (metierFilter !== "all" && l.metier !== metierFilter) return false;
      if (tierFilter !== "all" && l.score_tier !== tierFilter) return false;
      if (qualifFilter !== "all" && l.qualification !== (qualifFilter === "none" ? null : qualifFilter)) return false;
      if (noSiteOnly && l.has_website === true) return false;
      // Plafond dur : jamais de prospect > 15k abonnés.
      if ((l.followers ?? 0) > MAX_FOLLOWERS) return false;
      if (min != null && (l.followers ?? 0) < min) return false;
      if (max != null && (l.followers ?? 0) > max) return false;
      if (q && !`${l.username} ${l.full_name ?? ""} ${l.ville ?? ""} ${l.bio ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, metierFilter, tierFilter, qualifFilter, noSiteOnly, followersMin, followersMax, searchText]);

  const shown = useMemo(() => {
    let filtered = statusFilter === "all" ? baseFiltered : baseFiltered.filter((l) => l.status === statusFilter);
    if (stageFilter !== "all") {
      filtered = filtered.filter((l) => (stageFilter === "none" ? !l.stage : l.stage === stageFilter));
    }
    if (orderMode === "followers") {
      return filtered.slice().sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
    }
    if (orderMode !== "random") return filtered; // « recent » = ordre de chargement (discovered_at desc)
    // Fisher-Yates seedé (LCG) : mélange STABLE tant que le seed et le filtre ne
    // changent pas → la liste ne saute pas à chaque rendu, mais « Mélanger » rebat tout.
    const arr = filtered.slice();
    let s = shuffleSeed >>> 0 || 1;
    const rand = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 0x100000000);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [baseFiltered, statusFilter, stageFilter, orderMode, shuffleSeed]);

  // Regroupement par stade pour la vue Pipeline (ignore le filtre statut/stade :
  // les colonnes SONT l'axe stade). Tri intra-colonne : relance due, puis hot, puis récent.
  const pipeline = useMemo(() => {
    const cols: Record<string, IgLead[]> = { todo: [] };
    for (const s of STAGES) cols[s] = [];
    for (const l of baseFiltered) {
      const key = l.stage && cols[l.stage] ? l.stage : "todo";
      cols[key].push(l);
    }
    const now = Date.now();
    const rank = (l: IgLead) => {
      const due =
        l.next_followup_at && new Date(l.next_followup_at).getTime() <= now && l.stage !== "call_booke" && l.stage !== "perdu";
      const reply = (l.reply_count ?? 0) > 0;
      if (reply) return 0; // à traiter en priorité : ils ont répondu
      if (due) return 1;
      if (l.score_tier === "hot") return 2;
      if (l.score_tier === "warm") return 3;
      return 4;
    };
    for (const k of Object.keys(cols)) {
      cols[k].sort((a, b) => rank(a) - rank(b) || new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime());
    }
    return cols;
  }, [baseFiltered]);

  // Pastilles de statut : comptées sur la base filtrée → elles suivent les filtres actifs.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: baseFiltered.length, todo: 0, contacted: 0, positive: 0, negative: 0 };
    for (const l of baseFiltered) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [baseFiltered]);

  // Compte émetteur actif — alimente le résumé replié du cockpit sur mobile.
  const activeAcc = accounts.find((a) => a.id === activeAccount) ?? null;

  // Objectif du jour = nouveaux prospects contactés (M1) aujourd'hui vs cible.
  const todayM1 = stats?.day.m1 ?? 0;
  const goalReached = dailyGoal > 0 && todayM1 >= dailyGoal;

  // Célébration confettis une seule fois par jour, au franchissement de l'objectif.
  useEffect(() => {
    if (!goalReached) return;
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    if (localStorage.getItem("ig_goal_celebrated") === todayKey) return;
    localStorage.setItem("ig_goal_celebrated", todayKey);
    setCelebrate(true);
    const t = setTimeout(() => setCelebrate(false), 2600);
    return () => clearTimeout(t);
  }, [goalReached]);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {celebrate && <Confetti />}
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
          <PerformanceMenu />
          {loadError ? (
            <span
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400"
              title={loadError}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Prospects indisponibles</span>
            </span>
          ) : !firstLoaded ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Chargement…</span>
            </span>
          ) : (
            <span className="text-sm text-[var(--color-text-secondary)]">
              <span className="font-mono-num font-medium text-[var(--color-text-primary)]">{leads.length.toLocaleString("fr-FR")}</span>
              <span className="hidden sm:inline"> prospects en base</span>
            </span>
          )}
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
        <div className={`grid grid-cols-1 gap-x-6 gap-y-8 items-start ${
          cockpitCollapsed
            ? "xl:grid-cols-[2rem_minmax(0,1fr)]"
            : "xl:grid-cols-[2rem_400px_minmax(0,1fr)] 2xl:grid-cols-[2rem_440px_minmax(0,1fr)]"
        }`}>
        {/* Poignée repli/ouverture du cockpit (PC) — même emplacement dans les 2 états, ne scrolle jamais */}
        <div className="hidden xl:block xl:sticky xl:top-[4.5rem] self-start">
          <button
            onClick={toggleCockpit}
            title={cockpitCollapsed ? "Afficher le cockpit" : "Masquer le cockpit (plein écran pipeline)"}
            aria-label={cockpitCollapsed ? "Afficher le cockpit" : "Masquer le cockpit"}
            aria-expanded={!cockpitCollapsed}
            className="grid place-items-center h-14 w-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors cursor-pointer"
          >
            {cockpitCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        <section className={`relative min-w-0 xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100vh-5.5rem)] xl:overflow-y-auto ${cockpitCollapsed ? "xl:hidden" : ""}`}>
          {/* Mobile : barre-résumé repliable — le cockpit ne doit jamais enterrer la file. */}
          <button
            onClick={() => setCockpitOpen((o) => !o)}
            aria-expanded={cockpitOpen}
            className="tap xl:hidden w-full flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left cursor-pointer"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)] shrink-0">
              <Gauge className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--color-text-primary)]">Cockpit d&apos;envoi</span>
              <span className="block text-xs text-[var(--color-text-muted)] truncate">
                <span className={goalReached ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-[var(--color-text-secondary)] font-semibold"}>
                  {todayM1}/{dailyGoal}
                </span>{" "}
                aujourd&apos;hui{streak && streak.current > 0 ? ` · 🔥 ${streak.current}` : ""}
                {activeAcc ? ` · @${activeAcc.username}` : " · aucun compte"}
                {due.length > 0 ? ` · ${due.length} relance${due.length > 1 ? "s" : ""}` : ""}
              </span>
            </span>
            {due.length > 0 && (
              <span className="shrink-0 text-[11px] font-semibold rounded-md px-1.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono-num">
                {due.length}
              </span>
            )}
            <ChevronRight className={`w-4 h-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${cockpitOpen ? "rotate-90" : ""}`} />
          </button>

          {/* Contenu du cockpit : replié sur mobile (sauf ouverture), toujours visible ≥ xl. */}
          <div className={`space-y-4 ${cockpitOpen ? "mt-4" : "hidden"} xl:block xl:mt-0`}>
          {/* ── Objectif du jour (gamification sobre : anneau + série) ── */}
          <div className={`rounded-xl border p-3.5 flex items-center gap-3.5 transition-colors ${
            goalReached
              ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5"
              : "border-[var(--color-border)] bg-[var(--color-surface)]"
          }`}>
            <GoalRing value={todayM1} goal={dailyGoal} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">Objectif du jour</span>
                {streak && streak.current > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400"
                    title={`Record : ${streak.best} jour${streak.best > 1 ? "s" : ""} d'affilée`}
                  >
                    🔥 {streak.current}&nbsp;j
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {goalReached
                  ? "Atteint — beau travail 👏"
                  : `Encore ${dailyGoal - todayM1} contact${dailyGoal - todayM1 > 1 ? "s" : ""} à faire`}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] text-[var(--color-text-muted)]">Cible</span>
                <button
                  onClick={() => changeGoal(-5)}
                  aria-label="Diminuer l'objectif"
                  className="tap inline-flex items-center justify-center h-7 w-7 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer leading-none"
                >
                  −
                </button>
                <span className="font-mono-num text-xs w-6 text-center text-[var(--color-text-primary)]">{dailyGoal}</span>
                <button
                  onClick={() => changeGoal(5)}
                  aria-label="Augmenter l'objectif"
                  className="tap inline-flex items-center justify-center h-7 w-7 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer leading-none"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          {/* ── 2ᵉ objectif : engagement (réponses reçues) — récompense la QUALITÉ ── */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 flex items-center gap-3.5">
            <EngagementRing value={engagement?.repliesToday ?? 0} goal={REPLY_GOAL} />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">Réponses du jour</span>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {(engagement?.repliesToday ?? 0) >= REPLY_GOAL
                  ? "Belle journée d'échanges 💬"
                  : "Chaque réponse rapproche d'un call"}
              </p>
              <div className="flex items-center gap-2.5 mt-1.5 text-xs">
                <span className="inline-flex items-center gap-1 text-[#0f766e] dark:text-[#2dd4bf] font-medium">
                  <MessageSquareReply className="w-3.5 h-3.5" />
                  {engagement?.conversations ?? 0} en conversation
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                  <PhoneCall className="w-3.5 h-3.5" />
                  {engagement?.callsBooked ?? 0} booké{(engagement?.callsBooked ?? 0) > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="hidden xl:block text-base font-semibold text-[var(--color-text-primary)]">Cockpit d&apos;envoi</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              envoi 100 % manuel — l'outil trace, compte les quotas et programme les relances
            </p>
            <span className="flex-1" />
            <button
              onClick={sendDigest}
              className="tap inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
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
                      className="tap glass-input rounded-md px-1.5 py-0.5 text-[11px] font-medium cursor-pointer text-[var(--color-text-secondary)]"
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
          </div>
        </section>

        {/* ─── LA LISTE DES PROSPECTS (du plus récent au plus ancien) ─── */}
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Prospects</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {viewMode === "selection"
                ? "les comptes à démarcher aujourd'hui — qualifiés IA, mixés par métier"
                : viewMode === "pipeline"
                  ? "suivi par stade — chaque colonne = une étape de conversation"
                  : orderMode === "random"
                    ? "ordre aléatoire"
                    : orderMode === "followers"
                      ? "par abonnés (décroissant)"
                      : "du plus récent au plus ancien"}
            </p>
            <span className="flex-1" />
            {viewMode === "list" && (
              <span className="text-xs text-[var(--color-text-muted)]">
                <span className="font-mono-num">{shown.length}</span> affichés
              </span>
            )}
            {/* Bascule Sélection / Liste / Pipeline */}
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
              <button
                onClick={() => setView("selection")}
                aria-pressed={viewMode === "selection"}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === "selection"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Target className="w-3.5 h-3.5" /> Sélection du jour
                {selection && (
                  <span className={`font-mono-num ${viewMode === "selection" ? "" : "text-[var(--color-text-muted)]"}`}>
                    {selection.rows.filter((r) => !r.done_at && !r.skipped_at).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setView("list")}
                aria-pressed={viewMode === "list"}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === "list"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" /> Liste
              </button>
              <button
                onClick={() => setView("pipeline")}
                aria-pressed={viewMode === "pipeline"}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === "pipeline"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Pipeline
              </button>
            </div>
          </div>

          {/* Filtres statut (vue liste uniquement — en pipeline, les colonnes = les stades) */}
          {viewMode === "list" && (
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
          )}

          {/* Filtres secondaires : métier, priorité, verdict IA, sans site, recherche.
              Masqués en « Sélection du jour » : la liste y est déjà arrêtée, il n'y a plus rien à filtrer. */}
          {viewMode !== "selection" && (
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
            {viewMode === "list" && (
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="glass-input rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--color-text-primary)] outline-none cursor-pointer"
              >
                <option value="all">Stade : tous</option>
                <option value="none">Pas encore contacté</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_SHORT[s]}</option>
                ))}
              </select>
            )}
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noSiteOnly}
                onChange={(e) => setNoSiteOnly(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              Sans site uniquement
            </label>
            {/* Abonnés : bornes min / max */}
            <div className="inline-flex items-center gap-1 glass-input rounded-lg px-2 py-1">
              <Users className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={followersMin}
                onChange={(e) => setFollowersMin(e.target.value)}
                placeholder="min"
                className="w-14 bg-transparent border-none outline-none text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              />
              <span className="text-[var(--color-text-muted)] text-xs">–</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={followersMax}
                onChange={(e) => setFollowersMax(e.target.value)}
                placeholder="max"
                className="w-14 bg-transparent border-none outline-none text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              />
              <span className="text-[10px] text-[var(--color-text-muted)] pr-0.5">abonnés</span>
            </div>
            {/* Ordre : récents (défaut), abonnés (décroissant), ou aléatoire rebattu */}
            <div className="inline-flex items-center gap-1">
              <div className="ig-actions inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
                <button
                  onClick={() => setOrder("recent")}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    orderMode === "recent"
                      ? "bg-[var(--color-text-primary)] text-[var(--color-background)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  Récents
                </button>
                <button
                  onClick={() => setOrder("followers")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    orderMode === "followers"
                      ? "bg-[var(--color-accent)] text-white"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Users className="w-3 h-3" /> Abonnés
                </button>
                <button
                  onClick={() => setOrder("random")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    orderMode === "random"
                      ? "bg-[var(--color-accent)] text-white"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Shuffle className="w-3 h-3" /> Aléatoire
                </button>
              </div>
              {orderMode === "random" && (
                <button
                  onClick={reshuffle}
                  title="Rebattre l'ordre"
                  className="tap inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
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
          )}

          {/* Liste */}
          {viewMode === "selection" ? (
            <SelectionView
              selection={selection}
              loading={selLoading}
              refilling={refilling}
              message={selMsg}
              onRefill={refillSelection}
              onReload={loadSelection}
              onSkip={skipFromSelection}
              cardProps={{
                origin,
                activeAccount,
                copied,
                onQuickContact: quickContact,
                onSetStage: setStage,
                onSaveNote: saveNote,
                onOpenInsta: openInsta,
                onReplyLogged: (id, p) => setLeads((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x))),
              }}
            />
          ) : loadError ? (
            <div className="py-12 px-6 rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5 text-center">
              <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto mb-3" />
              <p className="text-[var(--color-text-primary)] text-sm font-medium mb-1">
                Impossible de charger les prospects
              </p>
              <p className="text-[var(--color-text-secondary)] text-xs max-w-md mx-auto mb-4">
                {loadError}
              </p>
              <button
                onClick={loadLeads}
                className="tap inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Loader2 className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Réessayer
              </button>
            </div>
          ) : loading && leads.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <Loader2 className="w-7 h-7 text-[var(--color-text-muted)] mx-auto animate-spin opacity-50" />
            </div>
          ) : (viewMode === "list" ? shown.length === 0 : baseFiltered.length === 0) ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border-strong)]">
              <Search className="w-9 h-9 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
              <p className="text-[var(--color-text-secondary)] text-sm">
                Aucun prospect avec ces filtres.
              </p>
              <p className="text-[var(--color-text-muted)] text-xs mt-1">
                Élargis les filtres, ou déplie « Trouver de nouveaux prospects » en haut de page.
              </p>
            </div>
          ) : viewMode === "pipeline" ? (
            /* ─── VUE PIPELINE : une colonne par stade, glisser-déposer souris + tactile ─── */
            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveDrag(null)}>
              <PipelineScroller>
                <div className="flex gap-3 min-w-min items-start">
                  {PIPE_COLS.map((col) => (
                    <PipelineColumn
                      key={col.key}
                      col={col}
                      items={pipeline[col.key] ?? []}
                      cardProps={{
                        origin,
                        activeAccount,
                        copied,
                        onQuickContact: quickContact,
                        onSetStage: setStage,
                        onSaveNote: saveNote,
                        onOpenInsta: openInsta,
                        onReplyLogged: (id, p) => setLeads((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x))),
                      }}
                    />
                  ))}
                </div>
              </PipelineScroller>
              <DragOverlay dropAnimation={null}>
                {activeDrag
                  ? (() => {
                      const l = leads.find((x) => x.id === activeDrag);
                      return l ? (
                        <div className="w-[240px] rounded-xl border border-[var(--color-accent)] bg-[var(--color-surface)] p-3 shadow-xl rotate-2 cursor-grabbing">
                          <div className="font-semibold text-[13px] text-[var(--color-text-primary)] truncate">@{l.username}</div>
                          <div className="text-[11px] text-[var(--color-text-muted)] truncate">
                            {l.profession_ia || l.metier || "—"}
                            {l.ville ? ` · ${l.ville}` : ""}
                          </div>
                        </div>
                      ) : null;
                    })()
                  : null}
              </DragOverlay>
            </DndContext>
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
                const dmSteps = instagramDmSequence(
                  {
                    metier: metierEff,
                    ville: l.ville ?? "",
                    bookingPlatform: l.booking_platform,
                    firstName: firstNameOf(l.full_name),
                    professionIa: l.profession_ia,
                  },
                  link,
                );
                const m1 = dmSteps.find((s) => s.step === "M1")?.text ?? "";
                const dmExpanded = expandedDm === l.id;
                const sty = STATUS_STYLES[l.status] ?? STATUS_STYLES.todo;
                const qualif = l.qualification ? QUALIF_BADGE[l.qualification] : null;

                const tier = l.score_tier ? TIER_DOT[l.score_tier] ?? TIER_DOT.cold : null;
                const rel = relanceLabel(l);

                return (
                  <div key={l.id} className="p-4 sm:p-5 transition-colors hover:bg-[var(--color-surface-2)]/60">
                    {/* Top row: username + signaux + statut */}
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-x-2.5 gap-y-0.5 flex-wrap">
                          <a
                            href={`https://instagram.com/${l.username}`}
                            target={INSTA_TAB}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                              e.preventDefault();
                              openInsta(l.username);
                            }}
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
                          {rel && (
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                rel.tone === "due"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : rel.tone === "reply"
                                    ? "text-[#0f766e] dark:text-[#2dd4bf]"
                                    : "text-[var(--color-text-muted)]"
                              }`}
                            >
                              {rel.tone === "due" ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                              ) : rel.tone === "reply" ? (
                                <MessageSquareReply className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              {rel.text}
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

                    {/* Notes internes — éditable inline, sauvegarde au blur */}
                    <div className="mb-2.5 max-w-[75ch]">
                      <NoteField id={l.id} value={l.notes} onSave={saveNote} />
                    </div>

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
                        <div className="flex flex-wrap items-center gap-2">
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
                                      className="tap flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
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
                                      className="tap flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
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
                                        firstName: firstNameOf(l.full_name),
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
                    <div className="ig-actions flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-[var(--color-border)]">
                      {l.status === "todo" ? (
                        // One-tap : M1 copié + Instagram ouvert + marqué « contacté » (KPI/quota).
                        <button
                          onClick={() => quickContact(l, m1)}
                          title="Copie le M1, ouvre Instagram et marque « contacté » (KPI + quota + stade)"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer max-sm:flex-1"
                        >
                          {copied === `quick-${l.id}` ? (
                            <><Check className="w-3.5 h-3.5" /> M1 copié · Insta ouvert</>
                          ) : (
                            <><Zap className="w-3.5 h-3.5" /> Prendre contact</>
                          )}
                        </button>
                      ) : (
                        <a
                          href={`https://instagram.com/${l.username}`}
                          target={INSTA_TAB}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                            e.preventDefault();
                            openInsta(l.username);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity no-underline max-sm:flex-1"
                        >
                          <Send className="w-3 h-3" />
                          Ouvrir le DM
                        </a>
                      )}
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
                      {l.status !== "todo" && (
                        <ReplyButton
                          prospectId={l.id}
                          accountId={activeAccount}
                          replyCount={l.reply_count ?? 0}
                          onLogged={(p) => setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, ...p } : x)))}
                        />
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
                      {/* Suppression d'un lead non pertinent — confirmation en 2 temps */}
                      {confirmDelete === l.id ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            onClick={() => deleteLead(l.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Confirmer
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                          >
                            Annuler
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(l.id)}
                          title="Supprimer ce lead (non pertinent)"
                          aria-label="Supprimer ce lead"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-transparent text-[var(--color-text-muted)] hover:text-rose-600 hover:border-[var(--color-border)] hover:bg-rose-500/5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="hidden sm:block flex-1" />
                      <span className="inline-flex max-sm:w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
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
                              className={`max-sm:flex-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
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

/** Anneau de progression de l'objectif du jour (accent → émeraude une fois atteint). */
function GoalRing({ value, goal }: { value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  const done = goal > 0 && value >= goal;
  return (
    <div className="relative shrink-0 h-16 w-16">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={done ? "#10b981" : "var(--color-accent)"}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono-num text-base font-semibold text-[var(--color-text-primary)] leading-none">{value}</span>
        <span className="font-mono-num text-[10px] text-[var(--color-text-muted)] leading-none mt-0.5">/{goal}</span>
      </div>
    </div>
  );
}

/** Pluie de confettis « objectif atteint » — décorative, coupée par reduced-motion. */
function Confetti() {
  const colors = ["#7c3aed", "#10b981", "#f59e0b", "#f43f5e", "#3b82f6"];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {Array.from({ length: 26 }).map((_, i) => (
        <span
          key={i}
          className="animate-confetti-fall absolute top-0 h-2 w-2 rounded-[2px]"
          style={{
            left: `${(i * 3.8 + (i % 5) * 4) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 7) * 90}ms`,
            animationDuration: `${1200 + (i % 6) * 220}ms`,
          }}
        />
      ))}
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

/** Anneau du 2ᵉ objectif (réponses du jour) — teinte teal fixe (distinct de l'objectif M1). */
function EngagementRing({ value, goal }: { value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0 h-16 w-16">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke="#0d9488" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono-num text-base font-semibold text-[var(--color-text-primary)] leading-none">{value}</span>
        <span className="font-mono-num text-[10px] text-[var(--color-text-muted)] leading-none mt-0.5">/{goal}</span>
      </div>
    </div>
  );
}

/**
 * Délai de relance EN CLAIR (ou signal « a répondu »). Le stade booké/perdu coupe
 * la relance ; une réponse reçue prime (on doit une réponse, pas une relance).
 */
function relanceLabel(l: IgLead): { text: string; tone: "due" | "wait" | "reply" } | null {
  if (l.stage === "call_booke" || l.stage === "perdu") return null;
  if ((l.reply_count ?? 0) > 0) return { text: "a répondu", tone: "reply" };
  if (!l.next_followup_at) return null;
  const diff = new Date(l.next_followup_at).getTime() - Date.now();
  if (diff <= 0) return { text: "relance due", tone: "due" };
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return { text: "relance imminente", tone: "wait" };
  if (h < 24) return { text: `relance dans ${h} h`, tone: "wait" };
  return { text: `relance dans ${Math.round(h / 24)} j`, tone: "wait" };
}

/**
 * Champ de notes INLINE — sauvegarde au blur si le texte a changé. Sert la fiche
 * liste (large) et la carte pipeline (`compact`). La colonne `notes` existe en base
 * et l'API PATCH l'accepte déjà ; ce champ la rend enfin visible/éditable.
 */
function NoteField({
  id,
  value,
  onSave,
  compact,
}: {
  id: string;
  value: string;
  onSave: (id: string, notes: string) => void;
  compact?: boolean;
}) {
  const [text, setText] = useState(value ?? "");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setText(value ?? "");
    setDirty(false);
  }, [value, id]);
  const commit = () => {
    if (!dirty) return;
    const next = text.trim();
    if (next !== (value ?? "").trim()) {
      onSave(id, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
    setDirty(false);
  };
  const empty = !text.trim();
  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-2)]/50 px-2 py-1.5 focus-within:border-[var(--color-accent)] transition-colors">
      <StickyNote className={`w-3 h-3 mt-0.5 shrink-0 ${empty ? "text-[var(--color-text-muted)]" : "text-[var(--color-accent)]"}`} />
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        onBlur={commit}
        placeholder="Ajouter une note…"
        rows={compact ? 1 : 2}
        aria-label="Note interne sur ce prospect"
        className="flex-1 resize-none bg-transparent border-none outline-none text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] placeholder:italic leading-snug"
      />
      {saved && <Check className="w-3 h-3 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
    </div>
  );
}

/**
 * Conteneur horizontal du pipeline avec la barre de défilement EN HAUT.
 * Le navigateur ne sait pas déplacer une scrollbar native, donc on masque
 * celle du conteneur réel et on affiche au-dessus une barre miroir (un
 * conteneur vide de même largeur de défilement), synchronisée dans les
 * deux sens. Aucun `transform` : le drag-and-drop dnd-kit reste intact.
 */
function PipelineScroller({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    const rail = railRef.current;
    if (!body || !rail) return;

    const measure = () => {
      setScrollWidth(body.scrollWidth);
      setOverflowing(body.scrollWidth > body.clientWidth + 1);
    };
    measure();

    // Le contenu change de largeur quand on ouvre/replie le cockpit ou quand
    // les colonnes se remplissent → on observe le conteneur ET la rangée.
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    if (body.firstElementChild) ro.observe(body.firstElementChild);

    let syncing = false;
    const mirror = (from: HTMLElement, to: HTMLElement) => () => {
      if (syncing) return;
      syncing = true;
      to.scrollLeft = from.scrollLeft;
      syncing = false;
    };
    const onRail = mirror(rail, body);
    const onBody = mirror(body, rail);
    rail.addEventListener("scroll", onRail, { passive: true });
    body.addEventListener("scroll", onBody, { passive: true });

    return () => {
      ro.disconnect();
      rail.removeEventListener("scroll", onRail);
      body.removeEventListener("scroll", onBody);
    };
  }, []);

  return (
    <div>
      <div
        ref={railRef}
        aria-hidden
        className={`overflow-x-auto overflow-y-hidden -mx-4 sm:mx-0 ${overflowing ? "h-[10px] mb-2" : "h-0"}`}
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
      <div ref={bodyRef} className="scrollbar-none overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
        {children}
      </div>
    </div>
  );
}

/** Poignées/handlers partagés entre la colonne et la carte du pipeline. */
type PipelineCardHandlers = {
  origin: string;
  activeAccount: string;
  copied: string | null;
  onQuickContact: (l: IgLead, m1: string) => void;
  onSetStage: (id: string, stage: Stage) => void;
  onSaveNote: (id: string, notes: string) => void;
  onOpenInsta: (username: string) => void;
  onReplyLogged: (id: string, p: Record<string, unknown>) => void;
  /** Vue « Sélection du jour » uniquement : retire le prospect de la liste du jour. */
  onSkip?: (id: string) => void;
};

/**
 * VUE « SÉLECTION DU JOUR » — la liste FERMÉE des comptes à démarcher aujourd'hui.
 * Elle remplace le tri manuel : le serveur a déjà choisi (qualifiés IA, mixés par
 * métier, plafond de chauffe respecté), reporté les non-traités de la veille, et
 * chaque M1 envoyé raye sa ligne tout seul.
 */
function SelectionView({
  selection,
  loading,
  refilling,
  message,
  onRefill,
  onReload,
  onSkip,
  cardProps,
}: {
  selection: DailySelection | null;
  loading: boolean;
  refilling: boolean;
  message: string | null;
  onRefill: () => void;
  onReload: () => void;
  onSkip: (id: string) => void;
  cardProps: PipelineCardHandlers;
}) {
  if (loading && !selection) {
    return (
      <div className="text-center py-16 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <Loader2 className="w-7 h-7 text-[var(--color-text-muted)] mx-auto animate-spin opacity-50" />
      </div>
    );
  }
  if (!selection) {
    return (
      <div className="py-12 px-6 rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5 text-center">
        <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto mb-3" />
        <p className="text-[var(--color-text-primary)] text-sm font-medium mb-1">Sélection du jour indisponible</p>
        <p className="text-[var(--color-text-secondary)] text-xs max-w-md mx-auto mb-4">
          {message ?? "Vérifie qu'un compte émetteur est configuré."}
        </p>
        <button
          onClick={onReload}
          className="tap inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" /> Réessayer
        </button>
      </div>
    );
  }

  const restants = selection.rows.filter((r) => !r.done_at && !r.skipped_at);
  const faits = selection.rows.filter((r) => r.done_at).length;
  const total = selection.rows.filter((r) => !r.skipped_at).length;
  const pct = total ? Math.round((faits / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Bandeau d'avancement */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono-num text-2xl font-semibold text-[var(--color-text-primary)]">
            {restants.length}
          </span>
          <span className="text-sm text-[var(--color-text-secondary)]">
            compte{restants.length > 1 ? "s" : ""} à démarcher aujourd&apos;hui
            <span className="text-[var(--color-text-muted)]"> — {faits}/{total} fait{faits > 1 ? "s" : ""}</span>
          </span>
          <span className="flex-1" />
          <button
            onClick={onReload}
            className="tap inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>

        <div className="mt-2.5 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>

        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
          {selection.carried > 0 && (
            <>
              <span className="text-amber-700 dark:text-amber-400 font-medium">{selection.carried} reporté{selection.carried > 1 ? "s" : ""} d&apos;hier</span>
              {" · "}
            </>
          )}
          {selection.stockLeft} qualifié{selection.stockLeft > 1 ? "s" : ""} en réserve · plafond du jour {selection.slots}
        </p>

        {/* Stock épuisé : on repart en chasse (scan hashtag + qualification IA). */}
        {selection.shortfall > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5 px-3 py-2.5 flex flex-wrap items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs text-amber-800 dark:text-amber-300 flex-1 min-w-40">
              {selection.shortfall} créneau{selection.shortfall > 1 ? "x" : ""} non pourvu{selection.shortfall > 1 ? "s" : ""} — plus assez de comptes qualifiés en stock.
            </span>
            <button
              onClick={onRefill}
              disabled={refilling}
              className="tap inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {refilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hash className="w-3.5 h-3.5" />}
              Aller en chercher
            </button>
          </div>
        )}

        {message && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{message}</p>}
      </div>

      {selection.rows.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border-strong)]">
          <Search className="w-9 h-9 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
          <p className="text-[var(--color-text-secondary)] text-sm">Aucun compte qualifié disponible.</p>
          <p className="text-[var(--color-text-muted)] text-xs mt-1">
            Lance « Aller en chercher » ci-dessus, ou déplie « Trouver de nouveaux prospects » en haut de page.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 items-start">
          {selection.rows.map((r) => {
            const traite = Boolean(r.done_at || r.skipped_at);
            return (
              <div key={r.prospect_id} className={traite ? "opacity-45" : ""}>
                <div className="mb-1 flex items-center gap-1.5 px-1 text-[10.5px] text-[var(--color-text-muted)]">
                  {r.done_at ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3 h-3" /> Accroche envoyée
                    </span>
                  ) : r.skipped_at ? (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <XCircle className="w-3 h-3" /> Écarté
                    </span>
                  ) : (
                    <span className="font-mono-num">#{r.rank + 1}</span>
                  )}
                  {r.carry_count > 0 && !traite && (
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      reporté ×{r.carry_count}
                    </span>
                  )}
                </div>
                <PipelineCard l={r.prospect} {...cardProps} onSkip={traite ? undefined : onSkip} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Colonne DROPPABLE du pipeline (dnd-kit) — surbrillance quand une carte la survole. */
function PipelineColumn({
  col,
  items,
  cardProps,
}: {
  col: { key: string; label: string; tone: StageTone };
  items: IgLead[];
  cardProps: PipelineCardHandlers;
}) {
  const droppable = col.key !== "todo";
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  const tone = TONE_STYLES[col.tone];
  const CAP = 60;
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[250px] shrink-0 rounded-xl p-1 -m-1 transition-colors ${
        isOver && droppable ? "bg-[var(--color-accent-soft)] ring-1 ring-[var(--color-accent)]/40" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-2 px-1 pb-2">
        <span className={`text-xs font-semibold ${tone.text}`}>{col.label}</span>
        <span className="font-mono-num text-[11px] text-[var(--color-text-muted)]">{items.length}</span>
      </div>
      <div className={`h-[3px] rounded-full mb-2.5 ${items.length ? tone.rail : "bg-[var(--color-border)]"}`} />
      <div className="flex flex-col gap-2 min-h-[44px]">
        {items.length === 0 ? (
          <p className="text-[11px] text-[var(--color-text-muted)] px-1 py-3 text-center">
            {isOver && droppable ? "Déposer ici" : "—"}
          </p>
        ) : (
          items.slice(0, CAP).map((l) => <PipelineCard key={l.id} l={l} {...cardProps} />)
        )}
        {items.length > CAP && (
          <p className="text-[11px] text-[var(--color-text-muted)] px-1 py-1 text-center">+{items.length - CAP} autres</p>
        )}
      </div>
    </div>
  );
}

/** Carte compacte de la vue Pipeline — draggable (souris + tactile), mêmes actions que la fiche liste. */
function PipelineCard({ l, origin, activeAccount, copied, onQuickContact, onSetStage, onSaveNote, onOpenInsta, onReplyLogged, onSkip }: { l: IgLead } & PipelineCardHandlers) {
  const metierEff =
    detectMetier(l.profession_ia, null) ||
    detectMetier(l.category, `${l.username} ${l.bio ?? ""}`) ||
    l.metier ||
    "";
  const link = origin ? `${origin}/di/${shortCode(l.id)}` : "";
  const m1 =
    instagramDmSequence(
      {
        metier: metierEff,
        ville: l.ville ?? "",
        bookingPlatform: l.booking_platform,
        firstName: firstNameOf(l.full_name),
        professionIa: l.profession_ia,
      },
      link,
    ).find((s) => s.step === "M1")?.text ?? "";
  const tier = l.score_tier ? TIER_DOT[l.score_tier] ?? TIER_DOT.cold : null;
  const rel = relanceLabel(l);
  const isTodo = !l.stage || l.status === "todo";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: l.id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2">
        {/* Poignée de glisser-déposer — seule zone qui déclenche le drag (souris + tactile).
            Absente dans la sélection du jour : pas de colonnes, donc rien à déplacer. */}
        {!onSkip && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Déplacer ce prospect vers un autre stade"
            className="shrink-0 -ml-1 mt-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        <a
          href={`https://instagram.com/${l.username}`}
          target={INSTA_TAB}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onOpenInsta(l.username);
          }}
          className="min-w-0 flex-1 font-semibold text-[13px] text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors truncate no-underline"
        >
          @{l.username}
        </a>
        {tier && <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${tier.dot}`} title={tier.label} />}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)] truncate">
        {l.profession_ia || l.metier || "—"}
        {l.ville ? ` · ${l.ville}` : ""}
        {l.followers != null ? ` · ${l.followers.toLocaleString("fr-FR")} ab.` : ""}
      </div>

      {(rel || l.booking_platform) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {rel && (
            <span
              className={`inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-full px-1.5 py-0.5 ${
                rel.tone === "due"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : rel.tone === "reply"
                    ? "bg-[#0d9488]/10 text-[#0f766e] dark:text-[#2dd4bf]"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              }`}
            >
              {rel.tone === "reply" ? <MessageSquareReply className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
              {rel.text}
            </span>
          )}
          {l.booking_platform && (
            <span className="text-[10.5px] font-medium rounded-full px-1.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400">
              {l.booking_platform}
            </span>
          )}
        </div>
      )}

      <div className="mt-2">
        <NoteField id={l.id} value={l.notes} onSave={onSaveNote} compact />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {isTodo ? (
          <button
            onClick={() => onQuickContact(l, m1)}
            title="Copie le M1, ouvre Instagram et marque « contacté »"
            className="tap inline-flex items-center justify-center gap-1.5 flex-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            {copied === `quick-${l.id}` ? (
              <><Check className="w-3 h-3" /> M1 copié</>
            ) : (
              <><Zap className="w-3 h-3" /> Prendre contact</>
            )}
          </button>
        ) : (
          <>
            <a
              href={`https://instagram.com/${l.username}`}
              target={INSTA_TAB}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                onOpenInsta(l.username);
              }}
              className="tap inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity no-underline"
            >
              <Send className="w-3 h-3" /> DM
            </a>
            <ReplyButton
              prospectId={l.id}
              accountId={activeAccount}
              replyCount={l.reply_count ?? 0}
              onLogged={(p) => onReplyLogged(l.id, p)}
            />
            {l.stage !== "call_booke" && (
              <button
                onClick={() => onSetStage(l.id, "call_booke")}
                title="Call booké"
                className="tap inline-flex items-center justify-center h-7 w-7 rounded-lg border border-[var(--color-border)] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
              >
                <PhoneCall className="w-3 h-3" />
              </button>
            )}
            {l.stage !== "perdu" && (
              <button
                onClick={() => onSetStage(l.id, "perdu")}
                title="Perdu"
                className="tap inline-flex items-center justify-center h-7 w-7 rounded-lg border border-[var(--color-border)] text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <XCircle className="w-3 h-3" />
              </button>
            )}
          </>
        )}
        {/* Sélection du jour : écarter le compte (il ne sera pas reporté demain). */}
        {onSkip && (
          <button
            onClick={() => onSkip(l.id)}
            title="Écarter de la sélection du jour"
            aria-label="Écarter de la sélection du jour"
            className="tap inline-flex items-center justify-center h-7 w-7 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
