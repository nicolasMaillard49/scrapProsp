// Cockpit Instagram — helpers SERVEUR (compteurs de quotas, relances dues, digest).
// Consommés par les routes /api/instagram/accounts, /dm, /digest et /api/cron/ig-digest.

import { supabase } from "./supabase";
import { sendTelegram } from "./notify";
import { warmupCaps, type AccountStatus, type Caps, STAGE_LABEL, type Stage } from "./igPipeline";

export interface AccountRow {
  id: string;
  username: string;
  status: AccountStatus;
  started_at: string;
  notes: string | null;
}

export interface AccountWithCounters extends AccountRow {
  caps: Caps;
  sentHour: number; // heure glissante
  sentDay: number; // depuis minuit (Europe/Paris)
}

/** Minuit Europe/Paris (epoch ms) — les quotas jour sont en heure française. */
export function parisDayStart(now = new Date()): Date {
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const offset = now.getTime() - paris.getTime();
  paris.setHours(0, 0, 0, 0);
  return new Date(paris.getTime() + offset);
}

/** Comptes + compteurs (heure glissante / jour Paris) + plafonds du plan de chauffe. */
export async function getAccountsWithCounters(now = new Date()): Promise<AccountWithCounters[]> {
  const { data: accounts, error } = await supabase
    .from("ig_accounts")
    .select("id, username, status, started_at, notes")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
  const dayStart = parisDayStart(now).toISOString();
  const out: AccountWithCounters[] = [];
  for (const a of (accounts ?? []) as AccountRow[]) {
    const [{ count: sentHour }, { count: sentDay }] = await Promise.all([
      supabase.from("ig_dm_log").select("id", { count: "exact", head: true }).eq("account_id", a.id).gte("sent_at", hourAgo),
      supabase.from("ig_dm_log").select("id", { count: "exact", head: true }).eq("account_id", a.id).gte("sent_at", dayStart),
    ]);
    out.push({
      ...a,
      caps: warmupCaps(a.started_at, a.status, now.getTime()),
      sentHour: sentHour ?? 0,
      sentDay: sentDay ?? 0,
    });
  }
  return out;
}

export interface DueFollowup {
  id: string;
  username: string;
  stage: string | null;
  followup_count: number;
  next_followup_at: string;
}

/** Prospects dont la relance est due (contactés, ni bookés ni perdus). */
export async function getDueFollowups(now = new Date(), limit = 25): Promise<DueFollowup[]> {
  const { data, error } = await supabase
    .from("instagram_prospects")
    .select("id, username, stage, followup_count, next_followup_at")
    .lte("next_followup_at", now.toISOString())
    .eq("status", "contacted")
    .order("next_followup_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as DueFollowup[]).filter((p) => p.stage !== "call_booke" && p.stage !== "perdu");
}

/* ────────────────────────────────────────────────────────────
 * Suivi global d'activité — journalier / hebdo / mensuel (heure de Paris).
 * Source : ig_dm_log (envois M1-M9 + relances) et instagram_prospects (ajouts).
 * ──────────────────────────────────────────────────────────── */

/** Lundi 00:00 Europe/Paris de la semaine courante. */
export function parisWeekStart(now = new Date()): Date {
  const dayStart = parisDayStart(now);
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const dow = (paris.getDay() + 6) % 7; // 0 = lundi
  return new Date(dayStart.getTime() - dow * 24 * 3600_000);
}

/** 1er du mois 00:00 Europe/Paris. */
export function parisMonthStart(now = new Date()): Date {
  const dayStart = parisDayStart(now);
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return new Date(dayStart.getTime() - (paris.getDate() - 1) * 24 * 3600_000);
}

export interface PeriodStats {
  sent: number; // tous les envois (M + R)
  m1: number; // nouvelles accroches = nouveaux prospects contactés
  relances: number; // R1-R3
  added: number; // prospects ajoutés (scan)
}

export interface SendStats {
  day: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
}

/** Statistiques d'activité sur les 3 fenêtres (jour / semaine / mois, Paris). */
export async function getSendStats(now = new Date()): Promise<SendStats> {
  const starts = { day: parisDayStart(now), week: parisWeekStart(now), month: parisMonthStart(now) };
  // La semaine peut commencer avant le 1er du mois : on requête depuis le plus ancien des deux.
  const sinceIso = new Date(Math.min(starts.week.getTime(), starts.month.getTime())).toISOString();
  const [{ data: logs }, { data: added }] = await Promise.all([
    supabase.from("ig_dm_log").select("step, sent_at").gte("sent_at", sinceIso).limit(10_000),
    supabase.from("instagram_prospects").select("discovered_at").gte("discovered_at", sinceIso).limit(10_000),
  ]);
  const empty = (): PeriodStats => ({ sent: 0, m1: 0, relances: 0, added: 0 });
  const out: SendStats = { day: empty(), week: empty(), month: empty() };
  const bump = (t: number, f: (p: PeriodStats) => void) => {
    if (Number.isNaN(t)) return;
    if (t >= starts.month.getTime()) f(out.month);
    if (t >= starts.week.getTime()) f(out.week);
    if (t >= starts.day.getTime()) f(out.day);
  };
  for (const r of (logs ?? []) as { step: string; sent_at: string }[]) {
    bump(Date.parse(r.sent_at), (p) => {
      p.sent++;
      if (r.step === "M1") p.m1++;
      if (r.step.startsWith("R")) p.relances++;
    });
  }
  for (const r of (added ?? []) as { discovered_at: string }[]) {
    bump(Date.parse(r.discovered_at), (p) => p.added++);
  }
  return out;
}

/** Compte les prospects par stade (funnel). */
export async function getFunnelCounts(): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("instagram_prospects")
    .select("stage")
    .not("stage", "is", null)
    .limit(10_000);
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as { stage: string }[]) {
    counts[r.stage] = (counts[r.stage] ?? 0) + 1;
  }
  return counts;
}

/** Construit + envoie le récap Telegram. Renvoie le texte (pour debug/aperçu). */
export async function sendCockpitDigest(now = new Date()): Promise<string> {
  const [accounts, due, funnel, stats] = await Promise.all([
    getAccountsWithCounters(now),
    getDueFollowups(now),
    getFunnelCounts(),
    getSendStats(now),
  ]);

  const lines: string[] = ["📊 <b>Prospection IG — récap</b>"];
  lines.push(
    `✉️ Jour <b>${stats.day.sent}</b> (${stats.day.m1} accroches · ${stats.day.relances} relances) · ` +
      `Semaine <b>${stats.week.sent}</b> · Mois <b>${stats.month.sent}</b>`,
  );
  if (!accounts.length) {
    lines.push("Aucun compte émetteur configuré.");
  }
  for (const a of accounts) {
    const statut = a.status === "chaud" ? "chaud" : a.status === "pause" ? "⏸ pause" : `chauffe J${a.caps.day}`;
    lines.push(`@${a.username} (${statut}) : <b>${a.sentDay}/${a.caps.daily}</b> aujourd'hui · ${a.sentHour}/${a.caps.hourly} dernière heure`);
  }
  if (due.length) {
    const top = due.slice(0, 5).map((d) => `@${d.username}`).join(", ");
    lines.push(`🔁 <b>${due.length} relance${due.length > 1 ? "s" : ""} due${due.length > 1 ? "s" : ""}</b> : ${top}${due.length > 5 ? ` (+${due.length - 5})` : ""}`);
  } else {
    lines.push("🔁 Aucune relance due.");
  }
  const funnelParts = (Object.entries(funnel) as [Stage, number][])
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${STAGE_LABEL[s] ?? s}`);
  if (funnelParts.length) lines.push(`📈 ${funnelParts.join(" · ")}`);

  const text = lines.join("\n");
  await sendTelegram(text);
  return text;
}
