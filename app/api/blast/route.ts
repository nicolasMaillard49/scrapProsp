import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { twilioClient, twilioConfigured, messagingServiceSid } from "@/app/lib/twilio";
import { toE164, salesSmsMsg, smsSegments } from "@/app/lib/sms";
import { shortCode } from "@/app/lib/links";

/**
 * POST /api/blast  { limit?, offset?, dryRun?, force? }
 * Blast de prospection AUTONOME (sélection + envoi côté serveur) — pensé pour
 * être déclenché par un cron / agent programmé sans dépendre d'un poste local.
 *
 * - Cible : prospects status=todo, MOBILES uniquement (toE164), dédupliqués par numéro.
 * - Garde-fou légal : 8h–20h (Europe/Paris), hors dimanche (override via force:true).
 * - Envoi via Messaging Service Twilio (opt-out STOP géré).
 * Protégé par la middleware (cookie prospects-auth).
 */
function demoBase(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_DEMO_BASE_URL;
  return env ? env.replace(/\/$/, "") : req.nextUrl.origin;
}

/** Heure de Paris (gère l'heure d'été via Intl) -> { hour, day(0=dim) }. */
function parisNow(): { hour: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? 1;
  return { hour, day };
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  }

  let body: { limit?: number; offset?: number; dryRun?: boolean; force?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const dryRun = body.dryRun === true;
  const limit = typeof body.limit === "number" ? body.limit : null;
  const offset = typeof body.offset === "number" ? body.offset : 0;

  // Garde-fou horaire (uniquement pour l'envoi réel)
  if (!dryRun && body.force !== true) {
    const { hour, day } = parisNow();
    if (day === 0 || hour < 8 || hour >= 20) {
      return NextResponse.json(
        { error: `Hors créneau légal (8h-20h Paris, hors dimanche). Heure Paris: ${hour}h, jour: ${day}.` },
        { status: 423 },
      );
    }
  }

  if (!dryRun && !twilioConfigured) {
    return NextResponse.json({ error: "Twilio non configuré" }, { status: 503 });
  }

  // ── Sélection : todo, mobiles uniques (ordre stable par id) ──
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("prospects")
      .select("id, name, metier, ville, phone, dirigeant_prenom, dirigeant_nom")
      .eq("status", "todo")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  const base = demoBase(req);
  const client = dryRun ? null : twilioClient();
  const results: Array<{ id: string; name: string; ok: boolean; to?: string; segments?: number; sid?: string; error?: string }> = [];

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
      const msg = await client!.messages.create({ messagingServiceSid, to, body: message });
      results.push({ id: p.id as string, name: p.name as string, ok: true, to, segments, sid: msg.sid });
    } catch (e) {
      results.push({ id: p.id as string, name: p.name as string, ok: false, to, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const totalSegments = results.reduce((n, r) => n + (r.ok ? r.segments ?? 0 : 0), 0);
  return NextResponse.json({
    dryRun,
    pool: cibles.length,
    targeted: lot.length,
    sent,
    failed: results.length - sent,
    totalSegments,
    results: results.slice(0, 5),
  });
}
