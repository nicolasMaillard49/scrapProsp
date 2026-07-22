import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 3600_000;

/** Jour civil Europe/Paris (YYYY-MM-DD) d'un timestamp ISO. */
function parisDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

/** Heure (0-23, Europe/Paris) d'un timestamp ISO. */
function parisHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", hour: "numeric", hour12: false }).format(new Date(iso)),
  ) % 24;
}

interface DayKpi {
  sent: number; // messages M1-M9
  accroches: number; // M1 uniquement
  relances: number; // R1-R3
  cohorte: Set<string>; // prospects accrochés (M1) ce jour-là
  repondants: Set<string>; // prospects ayant répondu ce jour-là (à n'importe quel stade)
  froid: Set<string>; // prospects dont c'est la 1re réponse = réponse à l'accroche M1
  positives: Set<string>;
  refus: Set<string>;
  autorepondeurs: Set<string>;
  pb: number; // arrivées à la problématique (M7 envoyés)
  propositions: number; // propositions d'appel (M8 envoyés)
  bookes: number; // prospects passés « call booké » (proxy : dernier DM ce jour-là)
  hmin: number | null;
  hmax: number | null;
}

interface ReplyRow {
  prospect_id: string | null;
  kind: string;
  received_at: string;
}

/** positive > refus > neutre : une réponse par prospect et par jour, la plus significative. */
function strongest(kinds: Set<string>): "positive" | "refus" | "neutre" {
  if (kinds.has("positive")) return "positive";
  if (kinds.has("refus")) return "refus";
  return "neutre";
}

/**
 * GET /api/instagram/kpi?days=N — agrégats JOURNALIERS de la prospection IG.
 * Deux consommateurs : l'Apps Script du Google Sheet de tracking (days=3) et la
 * page /instagram/kpi (historique). Les champs ajoutés sont additifs : l'ordre et
 * les clés historiques (date, sent, relances, heures, pb, propositions, bookes)
 * ne bougent pas, l'Apps Script continue de tourner tel quel.
 *
 * RÉPONSES — deux sources, dans cet ordre :
 *  1. `ig_replies` (migration 018) : le journal des réponses ENTRANTES saisi depuis
 *     le cockpit. Source de vérité — il voit les refus secs et distingue les
 *     autorépondeurs, qui ne comptent pas comme une réponse humaine.
 *  2. Repli sur le 1er M2 envoyé, pour les prospects antérieurs à la 018 : la trame
 *     n'envoie jamais de M2 sans réponse préalable. Sous-estime (rate les refus
 *     skippés sans M2), d'où la 018.
 * Un prospect qui a au moins une réponse journalisée n'est JAMAIS compté via le
 * repli — sinon il apparaîtrait deux fois.
 *
 * Volontairement public : uniquement des compteurs, aucune donnée nominative.
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const days = Math.min(180, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 3));
  const since = new Date(Date.now() - days * DAY_MS).toISOString();

  const [{ data: logs, error: e1 }, { data: booked, error: e2 }, { data: m2rows, error: e3 }, { data: replies, error: e4 }] =
    await Promise.all([
      supabase.from("ig_dm_log").select("prospect_id, step, sent_at").gte("sent_at", since).limit(20_000),
      supabase
        .from("instagram_prospects")
        .select("last_dm_at")
        .eq("stage", "call_booke")
        .gte("last_dm_at", since)
        .limit(10_000),
      // Tout l'historique des M2 (et pas seulement la fenêtre) : sinon un prospect
      // relancé dans la fenêtre après un M2 plus ancien serait compté deux fois.
      supabase
        .from("ig_dm_log")
        .select("prospect_id, sent_at")
        .eq("step", "M2")
        .order("sent_at", { ascending: true })
        .limit(20_000),
      // Idem : l'historique complet, pour savoir qui est déjà couvert par le journal.
      supabase
        .from("ig_replies")
        .select("prospect_id, kind, received_at")
        .order("received_at", { ascending: true })
        .limit(20_000),
    ]);
  if (e1 || e2 || e3) return NextResponse.json({ error: (e1 ?? e2 ?? e3)!.message }, { status: 500 });
  // `ig_replies` peut ne pas exister (migration 018 pas encore appliquée) : on
  // dégrade proprement sur le repli M2 au lieu de renvoyer 500.
  const replyRows = (e4 ? [] : (replies ?? [])) as ReplyRow[];

  // 1er M2 par prospect = date de sa réponse (repli).
  const firstM2 = new Map<string, string>();
  for (const r of (m2rows ?? []) as { prospect_id: string | null; sent_at: string }[]) {
    if (r.prospect_id && !firstM2.has(r.prospect_id)) firstM2.set(r.prospect_id, r.sent_at);
  }

  // Prospects couverts par le journal des réponses (hors autorépondeurs) + date de
  // leur TOUTE PREMIÈRE réponse. `replyRows` est trié par received_at croissant.
  const logged = new Set<string>();
  const firstReplyAt = new Map<string, string>();
  for (const r of replyRows) {
    if (!r.prospect_id || r.kind === "autorepondeur") continue;
    logged.add(r.prospect_id);
    if (!firstReplyAt.has(r.prospect_id)) firstReplyAt.set(r.prospect_id, r.received_at);
  }

  /**
   * RÉPONSE À FROID — la 1re réponse d'un prospect, donc sa réaction à l'accroche M1.
   * C'est la seule mesure honnête de la performance du message à froid : une réponse
   * à un M4 n'est pas une réponse à froid, la conversation était déjà engagée.
   * Repli sur le 1er M2 pour l'historique antérieur au journal.
   */
  const froidAt = new Map<string, string>();
  for (const [pid, at] of firstReplyAt) froidAt.set(pid, at);
  for (const [pid, at] of firstM2) if (!froidAt.has(pid)) froidAt.set(pid, at);

  const map = new Map<string, DayKpi>();
  const day = (d: string): DayKpi => {
    if (!map.has(d)) {
      map.set(d, {
        sent: 0, accroches: 0, relances: 0,
        cohorte: new Set(), repondants: new Set(), froid: new Set(), positives: new Set(), refus: new Set(), autorepondeurs: new Set(),
        pb: 0, propositions: 0, bookes: 0, hmin: null, hmax: null,
      });
    }
    return map.get(d)!;
  };

  for (const r of (logs ?? []) as { prospect_id: string | null; step: string; sent_at: string }[]) {
    const d = day(parisDate(r.sent_at));
    if (r.step.startsWith("R")) d.relances++;
    else d.sent++;
    if (r.step === "M1") {
      d.accroches++;
      if (r.prospect_id) d.cohorte.add(r.prospect_id);
    }
    if (r.step === "M7") d.pb++;
    if (r.step === "M8") d.propositions++;
    const h = parisHour(r.sent_at);
    d.hmin = d.hmin === null ? h : Math.min(d.hmin, h);
    d.hmax = d.hmax === null ? h : Math.max(d.hmax, h);
  }

  // Source 1 — le journal. Une ligne par (jour, prospect), du genre le plus fort.
  const perDayKinds = new Map<string, Set<string>>(); // clé « YYYY-MM-DD|prospect_id »
  for (const r of replyRows) {
    if (!r.prospect_id || r.received_at < since) continue;
    const key = `${parisDate(r.received_at)}|${r.prospect_id}`;
    const set = perDayKinds.get(key);
    if (set) set.add(r.kind);
    else perDayKinds.set(key, new Set([r.kind]));
  }
  for (const [key, kinds] of perDayKinds) {
    const sep = key.indexOf("|");
    const d = day(key.slice(0, sep));
    const pid = key.slice(sep + 1);
    const human = new Set([...kinds].filter((k) => k !== "autorepondeur"));
    if (human.size === 0) {
      d.autorepondeurs.add(pid);
      continue;
    }
    d.repondants.add(pid);
    const k = strongest(human);
    if (k === "positive") d.positives.add(pid);
    else if (k === "refus") d.refus.add(pid);
  }

  // Source 2 — repli M2, uniquement pour les prospects absents du journal.
  for (const [pid, ts] of firstM2) {
    if (logged.has(pid) || ts < since) continue;
    day(parisDate(ts)).repondants.add(pid);
  }

  // Réponses à froid : une seule fois par prospect, au jour de sa 1re réponse.
  for (const [pid, at] of froidAt) {
    if (at >= since) day(parisDate(at)).froid.add(pid);
  }

  for (const r of (booked ?? []) as { last_dm_at: string | null }[]) {
    if (r.last_dm_at) day(parisDate(r.last_dm_at)).bookes++;
  }

  const out = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      sent: v.sent,
      relances: v.relances,
      heures: v.hmin === null ? "" : v.hmin === v.hmax ? `${v.hmin}h` : `${v.hmin}h-${v.hmax}h`,
      pb: v.pb,
      propositions: v.propositions,
      bookes: v.bookes,
      // ── Champs additifs (page /instagram/kpi + colonnes E/F/G du Sheet) ──
      accroches: v.accroches,
      reponses: v.repondants.size, // colonne E
      reponses_froid: v.froid.size, // réponses à l'accroche M1 (1re réponse du prospect)
      refus: v.refus.size, // colonne F
      positives: v.positives.size, // colonne G
      autorepondeurs: v.autorepondeurs.size, // exclus de `reponses`
      // Cohorte : parmi les prospects accrochés CE jour-là, combien ont fini par répondre.
      // C'est le seul taux de réponse honnête (une réponse arrive souvent J+1/J+3).
      cohorte_reponses: [...v.cohorte].filter((id) => logged.has(id) || firstM2.has(id)).length,
    }));

  return NextResponse.json({
    days: out,
    meta: {
      // De quoi afficher honnêtement la fiabilité du chiffre côté UI.
      replies_logged: replyRows.length,
      prospects_logged: logged.size,
      replies_table: !e4,
    },
  });
}
