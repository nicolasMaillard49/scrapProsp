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
  const [accounts, due, funnel] = await Promise.all([
    getAccountsWithCounters(now),
    getDueFollowups(now),
    getFunnelCounts(),
  ]);

  const lines: string[] = ["📊 <b>Prospection IG — récap</b>"];
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
