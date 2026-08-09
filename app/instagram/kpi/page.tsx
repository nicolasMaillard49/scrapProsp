"use client";

// Historique des KPI de prospection Instagram, jour par jour.
// Source unique : /api/instagram/kpi (mêmes compteurs que le Google Sheet de tracking),
// donc les deux vues ne peuvent pas diverger.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Sheet, Send, MessageSquareReply, Percent,
  PhoneCall, CalendarCheck, Loader2, Search, ExternalLink, Users, ChevronRight, Copy, Check, Snowflake, RotateCcw,
} from "lucide-react";
import { STAGE_LABEL, type Stage } from "@/app/lib/igPipeline";

interface DayRow {
  date: string;
  /** Accroches M1/S1 — depuis le 05/08/2026 l'API n'y met plus les M2-M9. */
  sent: number;
  /** M2-M9 / S2-S5 : la suite de conversation, servie à part par l'API. */
  suite: number;
  sentAll: number;
  relances: number;
  heures: string;
  pb: number;
  propositions: number;
  bookes: number;
  accroches: number;
  reponses: number;
  reponses_froid: number;
  refus: number;
  positives: number;
  autorepondeurs: number;
  cohorte_reponses: number;
}

interface Meta {
  replies_logged: number;
  prospects_logged: number;
  replies_table: boolean;
}

interface ProspectRow {
  id: string;
  username: string;
  full_name: string | null;
  metier: string | null;
  ville: string | null;
  followers: number | null;
  status: string;
  stage: string | null;
  emetteur: string | null;
  first_dm_at: string;
  last_dm_at: string;
  first_step: string;
  last_step: string;
  messages: number;
  relances: number;
  next_followup_at: string | null;
  replied_at: string | null;
  reply_kind: string | null;
  /** "log" = réponse journalisée (fiable) · "m2" = déduite du 1er M2 (historique). */
  reply_source: "log" | "m2" | null;
}

/** Détail nominatif d'une journée (déplié au clic sur une ligne). */
interface DayProspect {
  username: string;
  full_name: string | null;
  metier: string | null;
  ville: string | null;
  followers: number | null;
  status: string;
  stage: string | null;
  score: number | null;
  emetteur: string | null;
  steps: { step: string; at: string }[];
  replies: { kind: string; at: string; excerpt: string | null }[];
}
type DayDetail = { state: "loading" } | { state: "error"; msg: string } | { state: "ok"; prospects: DayProspect[] };

/** Ordre d'affichage des étapes : la trame standard, la trame site, puis les relances. */
const STEP_ORDER = [
  "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9",
  "S1", "S2", "S3", "S4", "S5",
  "R1", "R2", "R3",
];
const STEP_TITLE: Record<string, string> = {
  M1: "Accroche", M2: "Contexte", M3: "Présentation", M4: "Anti-objection", M5: "Connexion",
  M6: "Focus", M7: "Douleur", M8: "Proposition d'appel", M9: "Questionnaire",
  S1: "Accroche (site)", S2: "On vous trouve où ?", S3: "Retournement + maquette",
  S4: "Proposition d'appel (site)", S5: "Questionnaire (site)",
  R1: "Relance 1", R2: "Relance 2", R3: "Relance 3",
};

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

const KIND_LABEL: Record<string, { label: string; cls: string }> = {
  positive: { label: "Intéressé", cls: "text-emerald-700 dark:text-emerald-400" },
  neutre: { label: "Neutre", cls: "text-[var(--color-text-secondary)]" },
  refus: { label: "Refus", cls: "text-rose-700 dark:text-rose-400" },
  autorepondeur: { label: "Auto", cls: "text-[var(--color-text-muted)]" },
};

const PERIODS = [7, 14, 30, 90] as const;
type Period = (typeof PERIODS)[number];

/** Issue d'un prospect démarché — une seule étiquette, par ordre de priorité. */
type Outcome = "booke" | "perdu" | "repondu" | "relance" | "silence";

function outcomeOf(p: ProspectRow): Outcome {
  if (p.stage === "call_booke") return "booke";
  if (p.stage === "perdu" || p.status === "negative") return "perdu";
  if (p.replied_at) return "repondu";
  if (p.relances > 0) return "relance";
  return "silence";
}

const OUTCOME: Record<Outcome, { label: string; cls: string }> = {
  booke: { label: "Call booké", cls: "border-[#d97706]/40 bg-[#d97706]/10 text-[#b45309] dark:text-[#f59e0b]" },
  perdu: { label: "Perdu", cls: "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]" },
  repondu: { label: "En conversation", cls: "border-[#0d9488]/40 bg-[#0d9488]/10 text-[#0f766e] dark:text-[#2dd4bf]" },
  relance: { label: "Relancé", cls: "border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] text-[var(--color-accent)]" },
  silence: { label: "Sans réponse", cls: "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)]" },
};

const FILTERS: { key: Outcome | "all"; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "repondu", label: "En conversation" },
  { key: "relance", label: "Relancés" },
  { key: "silence", label: "Sans réponse" },
  { key: "booke", label: "Calls bookés" },
  { key: "perdu", label: "Perdus" },
];

const nf = new Intl.NumberFormat("fr-FR");
const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 1000) / 10} %` : "—");

/** Jour civil Europe/Paris (YYYY-MM-DD) — même convention que l'API. */
const parisDay = (d: Date) => d.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });

const EMPTY = (date: string): DayRow => ({
  date, sent: 0, suite: 0, sentAll: 0, relances: 0, heures: "", pb: 0, propositions: 0, bookes: 0,
  accroches: 0, reponses: 0, reponses_froid: 0, refus: 0, positives: 0, autorepondeurs: 0, cohorte_reponses: 0,
});

/** Complète les jours sans activité : un trou dans un graphe se lit comme une absence de données. */
function fillGaps(rows: DayRow[], days: number): DayRow[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: DayRow[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const d = parisDay(new Date(now - i * 86_400_000));
    out.push(byDate.get(d) ?? EMPTY(d));
  }
  return out;
}

/** Échelle Y arrondie au « joli » multiple supérieur. */
function niceMax(v: number): number {
  if (v <= 5) return 5;
  const step = v <= 20 ? 5 : v <= 60 ? 10 : v <= 150 ? 25 : 50;
  return Math.ceil(v / step) * step;
}

const shortDate = (d: string) =>
  d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "";
/** Horodatage compact « 18/07 14:32 » (Europe/Paris). */
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
const longDate = (d: string) =>
  d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" }) : "…";

/** Récap Slack du jour, au format exact posté dans #04-kpis. */
function slackRecap(r: DayRow): string {
  const d = new Date(`${r.date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  // « Messages envoyés » = les M1 (accroches) UNIQUEMENT. Les M2-M9 sont la suite
  // d'une conversation déjà engagée, pas une prise de contact — les compter
  // gonflerait le dénominateur et écraserait le taux de réponse.
  const envoyes = r.accroches;
  // Le taux mesure l'accroche : réponses À FROID / M1 envoyés. Mettre toutes les
  // réponses au numérateur mélangerait des conversations déjà engagées.
  const taux = envoyes > 0
    ? `${(Math.round((r.reponses_froid / envoyes) * 10000) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
    : "—";
  // Vrais emoji Unicode plutôt que les shortcodes `:bar_chart:` — ceux-ci ne se
  // transforment en icône qu'APRÈS envoi dans Slack, donc illisibles à la relecture.
  // Slack accepte les deux à l'identique.
  return [
    `📊 Bilan prospection IG du ${d}`,
    `📧 Messages envoyés : ${envoyes}`,
    `🔄 Relances : ${r.relances}`,
    `❄️ Réponses à froid : ${r.reponses_froid} (taux ${taux})`,
    `💬 Réponses (tous stades) : ${r.reponses}`,
    `✅ Réponses positives : ${r.positives}`,
    `❌ Refus : ${r.refus}`,
    `📅 Propositions d'appel : ${r.propositions}`,
    `📞 RDV bookés : ${r.bookes}`,
  ].join("\n");
}

/**
 * Récap Slack ÉDITABLE avant copie.
 *
 * Les compteurs sont justes vis-à-vis de la base, mais la base ne sait pas tout :
 * un DM parti du téléphone n'est jamais journalisé, une réponse peut arriver
 * après la clôture du jour. Plutôt que de poster un chiffre qu'on sait faux ou
 * de corriger dans Slack après coup, on corrige ici. « Recalculer » restaure la
 * version issue des données.
 */
function CopySlack({ row }: { row: DayRow }) {
  const [done, setDone] = useState(false);
  const generated = slackRecap(row);
  const [text, setText] = useState(generated);
  // La ligne change (autre journée, ou données rafraîchies) → on repart du calcul.
  useEffect(() => setText(generated), [generated]);
  const edited = text !== generated;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
          Récap Slack #04-kpis
          {edited && <span className="ml-1.5 normal-case tracking-normal text-amber-600 dark:text-amber-400">· modifié</span>}
        </span>
        <div className="flex items-center gap-1.5">
        {edited && (
          <button
            onClick={() => setText(generated)}
            title="Revenir aux chiffres calculés depuis la base"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Recalculer
          </button>
        )}
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setDone(true);
              setTimeout(() => setDone(false), 2000);
            } catch { /* clipboard refusé : le texte reste sélectionnable ci-dessous */ }
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
        >
          {done ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          {done ? "Copié" : "Copier"}
        </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={text.split("\n").length}
        aria-label="Récap Slack, modifiable avant copie"
        className="w-full resize-y bg-transparent px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--color-text-secondary)] outline-none focus:text-[var(--color-text-primary)] font-mono-num"
      />
    </div>
  );
}

/** Panneau déplié sous une journée : récap Slack + qui a reçu quoi. */
function DayPanel({ row, detail }: { row: DayRow; detail: DayDetail | undefined }) {
  if (!detail || detail.state === "loading") {
    return <div className="py-6 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-[var(--color-text-muted)]" /></div>;
  }
  if (detail.state === "error") {
    return <div className="py-3 text-sm text-rose-600 dark:text-rose-400">{detail.msg}</div>;
  }

  const byStep = new Map<string, { p: DayProspect; at: string }[]>();
  for (const p of detail.prospects) {
    for (const s of p.steps) {
      const arr = byStep.get(s.step) ?? [];
      arr.push({ p, at: s.at });
      byStep.set(s.step, arr);
    }
  }
  const steps = STEP_ORDER.filter((s) => byStep.has(s));
  const answered = detail.prospects.filter((p) => p.replies.length > 0);

  return (
    <div className="space-y-4">
      <CopySlack row={row} />

      {steps.map((step) => {
        const list = (byStep.get(step) ?? []).sort((a, b) => a.at.localeCompare(b.at));
        return (
          <div key={step}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="font-mono-num text-xs font-semibold px-1.5 py-0.5 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                {step}
              </span>
              <span className="text-xs font-medium text-[var(--color-text-primary)]">{STEP_TITLE[step] ?? step}</span>
              <span className="font-mono-num text-xs text-[var(--color-text-muted)]">{list.length} compte{list.length > 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {list.map(({ p, at }, i) => (
                <a
                  key={`${p.username}-${step}-${i}`}
                  href={`https://instagram.com/${p.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={[p.full_name, p.metier, p.ville, p.followers != null ? `${nf.format(p.followers)} abonnés` : null, p.emetteur ? `via @${p.emetteur}` : null].filter(Boolean).join(" · ")}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[11.5px] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text-primary)] transition-colors no-underline"
                >
                  <span className="font-medium">@{p.username}</span>
                  <span className="font-mono-num text-[10px] text-[var(--color-text-muted)]">{hhmm(at)}</span>
                </a>
              ))}
            </div>
          </div>
        );
      })}

      {answered.length > 0 && (
        <div>
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-xs font-medium text-[var(--color-text-primary)]">Réponses reçues</span>
            <span className="font-mono-num text-xs text-[var(--color-text-muted)]">{answered.length} compte{answered.length > 1 ? "s" : ""}</span>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
            {answered.map((p) => (
              <div key={p.username} className="px-3 py-2 text-[11.5px]">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <a href={`https://instagram.com/${p.username}`} target="_blank" rel="noopener noreferrer"
                     className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] no-underline">@{p.username}</a>
                  {p.metier && <span className="text-[var(--color-text-muted)]">{p.metier}</span>}
                  {p.stage && <span className="text-[var(--color-text-muted)]">· {STAGE_LABEL[p.stage as Stage] ?? p.stage}</span>}
                </div>
                {p.replies.map((rep, i) => (
                  <div key={i} className="mt-0.5 flex items-baseline gap-2">
                    <span className="font-mono-num text-[10px] text-[var(--color-text-muted)] shrink-0">{hhmm(rep.at)}</span>
                    <span className={`shrink-0 font-medium ${KIND_LABEL[rep.kind]?.cls ?? ""}`}>{KIND_LABEL[rep.kind]?.label ?? rep.kind}</span>
                    {rep.excerpt && <span className="text-[var(--color-text-secondary)]">« {rep.excerpt} »</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {steps.length === 0 && answered.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">Aucun événement journalisé ce jour-là.</p>
      )}
    </div>
  );
}

export default function InstagramKpiPage() {
  const [period, setPeriod] = useState<Period>(30);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [filter, setFilter] = useState<Outcome | "all">("all");
  const [query, setQuery] = useState("");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dayCache, setDayCache] = useState<Record<string, DayDetail>>({});

  /** Déplie une journée — chargement à la demande, puis mis en cache. */
  const toggleDay = useCallback(async (date: string) => {
    if (openDay === date) { setOpenDay(null); return; }
    setOpenDay(date);
    if (dayCache[date]?.state === "ok") return;
    setDayCache((c) => ({ ...c, [date]: { state: "loading" } }));
    try {
      const res = await fetch(`/api/instagram/kpi/day?date=${date}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
      setDayCache((c) => ({ ...c, [date]: { state: "ok", prospects: json.prospects ?? [] } }));
    } catch (e) {
      setDayCache((c) => ({ ...c, [date]: { state: "error", msg: e instanceof Error ? e.message : String(e) } }));
    }
  }, [openDay, dayCache]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resDays, resPros] = await Promise.all([
        fetch(`/api/instagram/kpi?days=${period}`, { cache: "no-store" }),
        fetch(`/api/instagram/kpi/prospects?days=${period}`, { cache: "no-store" }),
      ]);
      const [jsonDays, jsonPros] = await Promise.all([resDays.json(), resPros.json()]);
      if (!resDays.ok) throw new Error(jsonDays.error ?? `Erreur ${resDays.status}`);
      if (!resPros.ok) throw new Error(jsonPros.error ?? `Erreur ${resPros.status}`);
      setRows(jsonDays.days ?? []);
      setMeta(jsonDays.meta ?? null);
      setProspects(jsonPros.prospects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const series = useMemo(() => fillGaps(rows, period), [rows, period]);

  const tot = useMemo(() => {
    const t = { suite: 0, accroches: 0, relances: 0, reponses: 0, froid: 0, refus: 0, positives: 0, cohorte: 0, pb: 0, propositions: 0, bookes: 0 };
    for (const r of series) {
      t.suite += r.suite;
      t.accroches += r.accroches;
      t.relances += r.relances;
      t.reponses += r.reponses;
      t.froid += r.reponses_froid;
      t.refus += r.refus;
      t.positives += r.positives;
      t.cohorte += r.cohorte_reponses;
      t.pb += r.pb;
      t.propositions += r.propositions;
      t.bookes += r.bookes;
    }
    return t;
  }, [series]);

  // Le graphe garde tous les jours (l'axe du temps doit rester continu) ; le
  // tableau ne montre que les jours travaillés — 18 lignes de « — » ne disent rien.
  const activeDays = useMemo(
    // `sentAll` et pas `sent` : une journée sans accroche mais passée à répondre
    // dans des conversations ouvertes reste une journée travaillée.
    () => [...series].reverse().filter((r) => r.sentAll + r.relances > 0),
    [series],
  );

  const yMax = useMemo(
    () => niceMax(Math.max(1, ...series.map((r) => Math.max(r.accroches, r.reponses)))),
    [series],
  );

  // Un label d'axe sur N pour éviter les collisions sur 30/90 jours.
  const labelEvery = period <= 14 ? 1 : period <= 30 ? 3 : 7;

  // Les six issues sont exclusives (leur somme = le total), donc « En conversation »
  // exclut les bookés et les perdus qui avaient pourtant répondu. Ce compteur-là
  // rattache toutes les réponses, et recolle avec la tuile « Réponses reçues ».
  const repliedTotal = useMemo(() => prospects.filter((p) => p.replied_at).length, [prospects]);

  const outcomeCounts = useMemo(() => {
    const c = { all: prospects.length, booke: 0, perdu: 0, repondu: 0, relance: 0, silence: 0 };
    for (const p of prospects) c[outcomeOf(p)]++;
    return c;
  }, [prospects]);

  const visibleProspects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prospects.filter((p) => {
      if (filter !== "all" && outcomeOf(p) !== filter) return false;
      if (q && !`${p.username} ${p.full_name ?? ""} ${p.metier ?? ""} ${p.ville ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [prospects, filter, query]);

  const TILES = [
    {
      label: "Messages envoyés", value: nf.format(tot.accroches), icon: Send,
      hint: `M1 uniquement · ${nf.format(tot.suite)} suites · ${nf.format(tot.relances)} relances`,
    },
    {
      label: "Réponses à froid", value: nf.format(tot.froid), icon: Snowflake,
      hint: `réponses au M1 · ${pct(tot.froid, tot.accroches)} des accroches`,
    },
    {
      label: "Réponses reçues", value: nf.format(tot.reponses), icon: MessageSquareReply,
      hint: `tous stades · ${nf.format(tot.positives)} intéressés · ${nf.format(tot.refus)} refus`,
    },
    {
      label: "Taux de réponse", value: pct(tot.cohorte, tot.accroches), icon: Percent,
      hint: `${nf.format(tot.cohorte)} / ${nf.format(tot.accroches)} M1 (cohorte)`,
    },
    { label: "Appels proposés", value: nf.format(tot.propositions), icon: PhoneCall, hint: `${nf.format(tot.pb)} arrivés à la douleur` },
    { label: "Calls bookés", value: nf.format(tot.bookes), icon: CalendarCheck, hint: pct(tot.bookes, tot.accroches) + " des accroches" },
  ];

  return (
    <div className="font-helvetica min-h-screen bg-[var(--color-background)]">
      <header className="sticky top-0 z-30 bg-[var(--color-surface)]/90 backdrop-blur-sm border-b border-[var(--color-border)]">
        <div className="px-4 sm:px-6 xl:px-8 h-14 flex items-center gap-4">
          <Link
            href="/instagram"
            className="shrink-0 p-1.5 -ml-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <h1 className="font-display text-xl sm:text-2xl text-[var(--color-text-primary)] truncate">
            KPI prospection
          </h1>
          <span className="flex-1" />
          <a
            href="https://docs.google.com/spreadsheets/d/11XFKK4UUUh0TOkreUsBchTv-Uon9TvTKfZ3pHWJmpmo/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors no-underline"
          >
            <Sheet className="w-3.5 h-3.5" /> Google Sheet
          </a>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 xl:px-8 py-8 space-y-8">
        {error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-500/25 bg-rose-50/60 dark:bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Fiabilité de la mesure des réponses — sans journal, tout repose sur le proxy M2. */}
        {meta && !loading && (meta.replies_table === false || meta.replies_logged === 0) && (
          <div className="rounded-xl border border-amber-300/50 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            {meta.replies_table === false ? (
              <>
                <strong>Migration 018 non appliquée.</strong> La table <code>ig_replies</code> n&apos;existe pas encore :
                les réponses restent <em>déduites</em> du 1<sup>er</sup> M2, et les refus secs ne sont pas comptés. Lancer{" "}
                <code>npm run migrate:018</code>.
              </>
            ) : (
              <>
                <strong>Aucune réponse journalisée pour l&apos;instant.</strong> Les chiffres ci-dessous sont{" "}
                <em>déduits</em> du 1<sup>er</sup> M2. Utilise « Réponse reçue » sur la fiche d&apos;un prospect dans le
                cockpit pour alimenter le vrai compteur — c&apos;est ce qui fait apparaître les refus.
              </>
            )}
          </div>
        )}

        {/* Période */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Période</span>
          <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  period === p
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {p} jours
              </button>
            ))}
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            du {longDate(series[0]?.date ?? "")} au {longDate(series[series.length - 1]?.date ?? "")}
          </span>
        </div>

        {/* Totaux de la période */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {TILES.map((t) => (
            <div key={t.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-2">
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </div>
              <div className="font-mono-num text-2xl font-semibold text-[var(--color-text-primary)] tabular-nums">
                {loading && rows.length === 0 ? "…" : t.value}
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] mt-1 truncate">{t.hint}</div>
            </div>
          ))}
        </div>

        {/* Volume jour par jour */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Volume jour par jour</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Messages envoyés = <strong>accroches M1 uniquement</strong> (les M2-M9 et les relances sont dans le tableau).
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-[#7c3aed] dark:bg-[#8b5cf6]" /> Messages envoyés (M1)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-[#0d9488]" /> Réponses
              </span>
            </div>
          </div>

          {loading && rows.length === 0 ? (
            <div className="h-56 grid place-items-center">
              <Loader2 className="w-7 h-7 text-[var(--color-text-muted)] animate-spin opacity-50" />
            </div>
          ) : (
            <div className="flex gap-3">
              {/* Axe Y */}
              <div className="relative h-56 w-9 shrink-0">
                {[1, 0.75, 0.5, 0.25, 0].map((f) => (
                  <span
                    key={f}
                    style={{ top: `${(1 - f) * 100}%` }}
                    className="absolute right-0 -translate-y-1/2 font-mono-num text-[10px] text-[var(--color-text-muted)] tabular-nums"
                  >
                    {Math.round(yMax * f)}
                  </span>
                ))}
              </div>

              {/* Tracé — pas de conteneur scrollable : il rognerait les tooltips. */}
              <div className="relative flex-1 min-w-0">
                <div className="relative h-56">
                  {/* Grille */}
                  {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                    <span
                      key={f}
                      style={{ top: `${f * 100}%` }}
                      className={`absolute inset-x-0 border-t ${f === 1 ? "border-[var(--color-border-strong)]" : "border-[var(--color-border)]"}`}
                    />
                  ))}

                  <div className="absolute inset-0 flex items-end gap-[3px]">
                    {series.map((r, i) => {
                      const msg = r.accroches;
                      // Ancrage de la tooltip : centrée, sauf près des bords où elle sortirait de la carte.
                      const anchor =
                        i < series.length * 0.2
                          ? "left-0"
                          : i > series.length * 0.8
                            ? "right-0"
                            : "left-1/2 -translate-x-1/2";
                      return (
                        <div
                          key={r.date}
                          onMouseEnter={() => setHover(i)}
                          onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                          className={`group relative flex-1 h-full flex items-end justify-center gap-[2px] rounded-t-sm transition-colors ${
                            hover === i ? "bg-[var(--color-surface-2)]" : ""
                          }`}
                        >
                          <span
                            style={{ height: `${(msg / yMax) * 100}%` }}
                            className={`w-full max-w-[14px] rounded-t-[4px] bg-[#7c3aed] dark:bg-[#8b5cf6] ${msg ? "min-h-[2px]" : ""}`}
                          />
                          <span
                            style={{ height: `${(r.reponses / yMax) * 100}%` }}
                            className={`w-full max-w-[14px] rounded-t-[4px] bg-[#0d9488] ${r.reponses ? "min-h-[2px]" : ""}`}
                          />

                          {hover === i && (
                            <div className={`pointer-events-none absolute bottom-full mb-2 ${anchor} z-10 w-max max-w-[15rem] rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-lg px-3 py-2`}>
                              <div className="text-[11px] font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                                {longDate(r.date)}
                              </div>
                              <dl className="mt-1.5 space-y-0.5 text-[11px] whitespace-nowrap">
                                <div className="flex items-center justify-between gap-4">
                                  <dt className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                                    <span className="w-2 h-2 rounded-[2px] bg-[#7c3aed] dark:bg-[#8b5cf6]" /> Messages (M1)
                                  </dt>
                                  <dd className="font-mono-num font-medium text-[var(--color-text-primary)]">{nf.format(msg)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <dt className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                                    <span className="w-2 h-2 rounded-[2px] bg-[#0d9488]" /> Réponses
                                  </dt>
                                  <dd className="font-mono-num font-medium text-[var(--color-text-primary)]">{nf.format(r.reponses)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-4 text-[var(--color-text-muted)]">
                                  <dt>Accroches</dt>
                                  <dd className="font-mono-num">{nf.format(r.accroches)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-4 text-[var(--color-text-muted)]">
                                  <dt>Calls bookés</dt>
                                  <dd className="font-mono-num">{nf.format(r.bookes)}</dd>
                                </div>
                              </dl>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Axe X */}
                <div className="flex gap-[3px] pt-2">
                  {series.map((r, i) => (
                    <span
                      key={r.date}
                      className="flex-1 text-center font-mono-num text-[10px] text-[var(--color-text-muted)] tabular-nums truncate"
                    >
                      {i % labelEvery === 0 ? shortDate(r.date) : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Détail */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Détail quotidien</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              du plus récent au plus ancien · jour civil Europe/Paris · les jours sans envoi sont masqués
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                  <th className="text-left font-medium px-4 py-3">Jour</th>
                  <th className="text-right font-medium px-3 py-3">Accroches</th>
                  <th className="text-right font-medium px-3 py-3">Suite</th>
                  <th className="text-right font-medium px-3 py-3">Relances</th>
                  <th className="text-right font-medium px-3 py-3" title="1re réponse du prospect = réaction à l'accroche M1">À froid</th>
                  <th className="text-right font-medium px-3 py-3" title="Toutes les réponses reçues ce jour-là, quel que soit le stade">Réponses</th>
                  <th className="text-right font-medium px-3 py-3">Intéressés</th>
                  <th className="text-right font-medium px-3 py-3">Refus</th>
                  <th className="text-right font-medium px-3 py-3">Taux</th>
                  <th className="text-right font-medium px-3 py-3">Douleur</th>
                  <th className="text-right font-medium px-3 py-3">Appels</th>
                  <th className="text-right font-medium px-3 py-3">Bookés</th>
                  <th className="text-right font-medium px-4 py-3">Plage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {activeDays.map((r) => {
                  const open = openDay === r.date;
                  return (
                    <Fragment key={r.date}>
                    <tr
                      onClick={() => toggleDay(r.date)}
                      aria-expanded={open}
                      title="Voir les comptes touchés ce jour-là"
                      className={`cursor-pointer transition-colors hover:bg-[var(--color-surface-2)]/60 text-[var(--color-text-secondary)] ${open ? "bg-[var(--color-surface-2)]/60" : ""}`}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap text-[var(--color-text-primary)] font-medium">
                        <ChevronRight className={`inline w-3.5 h-3.5 mr-1 -mt-0.5 text-[var(--color-text-muted)] transition-transform ${open ? "rotate-90" : ""}`} />
                        {longDate(r.date)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-num tabular-nums">{r.accroches || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono-num tabular-nums">{r.suite || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono-num tabular-nums">{r.relances || "—"}</td>
                      <td className={`px-3 py-2.5 text-right font-mono-num tabular-nums ${r.reponses_froid ? "text-[#0d9488] font-semibold" : ""}`}>
                        {r.reponses_froid || "—"}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono-num tabular-nums ${r.reponses ? "text-[#0d9488]" : ""}`}>
                        {r.reponses || "—"}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono-num tabular-nums ${r.positives ? "text-emerald-700 dark:text-emerald-400 font-medium" : ""}`}>
                        {r.positives || "—"}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono-num tabular-nums ${r.refus ? "text-rose-700 dark:text-rose-400" : ""}`}>
                        {r.refus || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-num tabular-nums">
                        {r.accroches ? pct(r.cohorte_reponses, r.accroches) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-num tabular-nums">{r.pb || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono-num tabular-nums">{r.propositions || "—"}</td>
                      <td className={`px-3 py-2.5 text-right font-mono-num tabular-nums ${r.bookes ? "text-[#d97706] font-medium" : ""}`}>
                        {r.bookes || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-num tabular-nums whitespace-nowrap">{r.heures || "—"}</td>
                    </tr>
                    {open && (
                      <tr className="bg-[var(--color-surface-2)]/40">
                        <td colSpan={13} className="px-4 py-4">
                          <DayPanel row={r} detail={dayCache[r.date]} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
                {!loading && activeDays.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center text-sm text-[var(--color-text-muted)]">
                      Aucun envoi sur cette période.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--color-border-strong)] bg-[var(--color-surface-2)]/60 text-[var(--color-text-primary)] font-medium">
                  <td className="px-4 py-3">Total {period} jours</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{nf.format(tot.accroches)}</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{nf.format(tot.suite)}</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{nf.format(tot.relances)}</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{nf.format(tot.froid)}</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{nf.format(tot.reponses)}</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{nf.format(tot.positives)}</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{nf.format(tot.refus)}</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{pct(tot.cohorte, tot.accroches)}</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{nf.format(tot.pb)}</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{nf.format(tot.propositions)}</td>
                  <td className="px-3 py-3 text-right font-mono-num tabular-nums">{nf.format(tot.bookes)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed max-w-3xl">
            <span className="font-medium text-[var(--color-text-secondary)]">Lecture.</span>{" "}
            <em>Accroches</em> = M1 · <em>Suite</em> = M2-M9 · <em>Réponses</em> = prospects distincts ayant répondu ce
            jour-là, <strong>autorépondeurs exclus</strong>, ventilés en <em>Intéressés</em> / <em>Refus</em> (un
            prospect qui répond plusieurs fois dans la journée compte une fois, au genre le plus fort).{" "}
            <em>Taux</em> = part des prospects accrochés ce jour-là qui ont fini par répondre, même plusieurs jours plus
            tard. Colonnes Réponses / Refus / Intéressés = les colonnes E / F / G du Google Sheet, désormais calculées.
          </p>
        </section>

        {/* Comptes démarchés — le détail nominatif derrière les compteurs */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Comptes démarchés</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {nf.format(outcomeCounts.all)} comptes touchés · {nf.format(repliedTotal)} ont répondu · du DM le plus
              récent au plus ancien
            </p>
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => {
              const n = outcomeCounts[f.key];
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    filter === f.key
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {f.label}
                  <span className="font-mono-num tabular-nums opacity-70">{nf.format(n)}</span>
                </button>
              );
            })}
            <span className="flex-1" />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pseudo, métier, ville…"
                className="w-56 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                  <th className="text-left font-medium px-4 py-3">Compte</th>
                  <th className="text-left font-medium px-3 py-3">Métier · Ville</th>
                  <th className="text-right font-medium px-3 py-3">Abonnés</th>
                  <th className="text-left font-medium px-3 py-3">Émetteur</th>
                  <th className="text-left font-medium px-3 py-3">Séquence</th>
                  <th className="text-right font-medium px-3 py-3">Relances</th>
                  <th className="text-left font-medium px-3 py-3">1<sup>er</sup> contact</th>
                  <th className="text-left font-medium px-3 py-3">Réponse</th>
                  <th className="text-left font-medium px-4 py-3">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {visibleProspects.map((p) => {
                  const o = outcomeOf(p);
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-[var(--color-surface-2)]/60 text-[var(--color-text-secondary)]">
                      <td className="px-4 py-2.5">
                        <a
                          href={`https://instagram.com/${p.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors no-underline"
                        >
                          @{p.username}
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                        </a>
                        {p.full_name && (
                          <div className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[22ch]">{p.full_name}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {p.metier ?? "—"}
                        {p.ville && <span className="text-[var(--color-text-muted)]"> · {p.ville}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-num tabular-nums text-xs">
                        {p.followers != null ? nf.format(p.followers) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{p.emetteur ? `@${p.emetteur}` : "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-mono-num text-xs">
                          {p.first_step}
                          {p.last_step !== p.first_step && (
                            <>
                              <span className="text-[var(--color-text-muted)] mx-1">→</span>
                              {p.last_step}
                            </>
                          )}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-muted)] ml-1.5">
                          ({p.messages} DM{p.messages > 1 ? "s" : ""})
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono-num tabular-nums ${p.relances ? "text-[var(--color-accent)] font-medium" : ""}`}>
                        {p.relances || "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono-num tabular-nums text-xs whitespace-nowrap">{stamp(p.first_dm_at)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {p.replied_at ? (
                          <>
                            <span
                              className={`font-mono-num tabular-nums text-xs font-medium ${p.reply_source === "log" ? "text-[#0d9488]" : "text-[var(--color-text-secondary)]"}`}
                              title={p.reply_source === "log" ? "Réponse journalisée" : "Déduite du 1er M2 — antérieure au journal des réponses"}
                            >
                              {stamp(p.replied_at)}
                              {p.reply_source === "m2" && <span className="text-[var(--color-text-muted)]">*</span>}
                            </span>
                            {p.reply_kind && KIND_LABEL[p.reply_kind] && (
                              <div className={`text-[11px] ${KIND_LABEL[p.reply_kind].cls}`}>{KIND_LABEL[p.reply_kind].label}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-medium ${OUTCOME[o].cls}`}>
                          {OUTCOME[o].label}
                        </span>
                        {p.stage && (
                          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                            {STAGE_LABEL[p.stage as Stage] ?? p.stage}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && visibleProspects.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center">
                      <Users className="w-7 h-7 text-[var(--color-text-muted)] mx-auto opacity-40" />
                      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                        {prospects.length === 0
                          ? "Aucun DM envoyé sur cette période."
                          : "Aucun compte ne correspond à ce filtre."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed max-w-3xl">
            <span className="font-medium text-[var(--color-text-secondary)]">Séquence</span> = 1<sup>re</sup> et dernière
            étape de la trame envoyées sur la période (M1 accroche → M9 questionnaire), relances R1-R3 comptées à part.{" "}
            <span className="font-medium text-[var(--color-text-secondary)]">Réponse</span> = horodatage de la réponse
            entrante journalisée depuis le cockpit ; un astérisque (*) signale une date <em>déduite</em> du 1<sup>er</sup> M2,
            pour les prospects antérieurs au journal des réponses.{" "}
            <span className="font-medium text-[var(--color-text-secondary)]">Émetteur</span> = le compte NMF qui a
            envoyé le dernier DM.
          </p>
        </section>
      </main>
    </div>
  );
}
