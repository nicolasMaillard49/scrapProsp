import { supabase } from "./supabase";
import { twilioClient, twilioConfigured, messagingServiceSid } from "./twilio";
import { toE164, salesSmsMsg, smsSegments } from "./sms";
import { shortCode } from "./links";
import { logOutboundSms, markProspectSmsSent } from "./smsLog";

export interface BlastResult {
  pool: number;
  targeted: number;
  sent: number;
  failed: number;
  totalSegments: number;
  results: Array<{ id: string; name: string; ok: boolean; to?: string; segments?: number; sid?: string; error?: string }>;
}

/** Erreur métier du blast (mappée en code HTTP par les routes). */
export class BlastError extends Error {
  constructor(public code: "OUT_OF_WINDOW" | "TWILIO_UNCONFIGURED", message: string) {
    super(message);
    this.name = "BlastError";
  }
}

export interface RunBlastOpts {
  limit?: number | null;
  offset?: number;
  force?: boolean;
  dryRun?: boolean;
  base: string;
}

/** Heure de Paris (gère l'heure d'été via Intl) -> { hour, day(0=dim) }. */
function parisNow(): { hour: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", weekday: "short", hour12: false });
  const parts = fmt.formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? 1;
  return { hour, day };
}

/**
 * Blast de prospection : sélection todo + mobiles uniques, garde-fou légal Paris
 * (8h-20h hors dimanche, sauf force), envoi via Messaging Service, journalisation
 * + bascule prospect en sms_sent + statusCallback. Lève BlastError sur garde-fou.
 */
export async function runBlast(opts: RunBlastOpts): Promise<BlastResult> {
  const { limit = null, offset = 0, force = false, dryRun = false, base } = opts;

  if (!dryRun && !force) {
    const { hour, day } = parisNow();
    if (day === 0 || hour < 8 || hour >= 20) {
      throw new BlastError("OUT_OF_WINDOW", `Hors créneau légal (8h-20h Paris, hors dimanche). Heure Paris: ${hour}h, jour: ${day}.`);
    }
  }
  if (!dryRun && !twilioConfigured) {
    throw new BlastError("TWILIO_UNCONFIGURED", "Twilio non configuré");
  }

  // Sélection : todo, mobiles uniques (ordre stable par id)
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("prospects")
      .select("id, name, metier, ville, phone, dirigeant_prenom, dirigeant_nom")
      .eq("status", "todo")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as Array<Record<string, unknown>>));
    if (data.length < 1000) break;
  }

  const seen = new Set<string>();
  const cibles = rows.filter((p) => {
    const e164 = toE164(p.phone as string);
    if (!e164 || seen.has(e164)) return false;
    seen.add(e164);
    return true;
  });

  let lot = cibles.slice(offset);
  if (limit != null) lot = lot.slice(0, limit);

  const client = dryRun ? null : twilioClient();
  const results: BlastResult["results"] = [];

  for (const p of lot) {
    const to = toE164(p.phone as string);
    const link = `${base}/d/${shortCode(p.id as string)}`;
    const message = salesSmsMsg(
      {
        name: p.name as string,
        metier: p.metier as string,
        ville: p.ville as string,
        dirigeant_prenom: p.dirigeant_prenom as string | null,
        dirigeant_nom: p.dirigeant_nom as string | null,
      },
      link,
    );
    const segments = smsSegments(message);
    if (!to) {
      results.push({ id: p.id as string, name: p.name as string, ok: false, error: "Numéro non mobile" });
      continue;
    }
    if (dryRun) {
      results.push({ id: p.id as string, name: p.name as string, ok: true, to, segments });
      continue;
    }
    try {
      const msg = await client!.messages.create({ messagingServiceSid, to, body: message, statusCallback: `${base}/api/sms/status` });
      await logOutboundSms({ prospectId: p.id as string, to, body: message, segments, sid: msg.sid });
      await markProspectSmsSent(p.id as string);
      results.push({ id: p.id as string, name: p.name as string, ok: true, to, segments, sid: msg.sid });
    } catch (e) {
      results.push({ id: p.id as string, name: p.name as string, ok: false, to, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const totalSegments = results.reduce((n, r) => n + (r.ok ? r.segments ?? 0 : 0), 0);
  return { pool: cibles.length, targeted: lot.length, sent, failed: results.length - sent, totalSegments, results };
}
