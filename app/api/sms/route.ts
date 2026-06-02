import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { twilioClient, twilioConfigured, messagingServiceSid } from "@/app/lib/twilio";
import { toE164, salesSmsMsg, smsSegments } from "@/app/lib/sms";

interface SendResult {
  id: string;
  name: string;
  ok: boolean;
  to?: string;
  segments?: number;
  sid?: string;
  error?: string;
}

/** Base publique pour les liens de démo (env > origine de la requête). */
function demoBase(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_DEMO_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  return req.nextUrl.origin;
}

/**
 * POST /api/sms  { ids: string[], dryRun?: boolean }
 * Envoie le SMS de prospection (lien démo) à chaque prospect.
 * dryRun=true => construit le message sans rien envoyer (test/coût).
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  }

  let body: { ids?: string[]; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
  const dryRun = body.dryRun === true;
  if (ids.length === 0) {
    return NextResponse.json({ error: "Aucun id fourni" }, { status: 400 });
  }

  if (!dryRun && !twilioConfigured) {
    return NextResponse.json(
      { error: "Twilio non configuré (numéro FR en cours de validation ?). Utilise dryRun:true pour tester." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("prospects")
    .select("id, name, metier, ville, phone")
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const base = demoBase(req);
  const client = dryRun ? null : twilioClient();
  const results: SendResult[] = [];

  for (const p of data ?? []) {
    const to = toE164(p.phone);
    const link = `${base}/demo/${p.id}`;
    const message = salesSmsMsg({ name: p.name, metier: p.metier, ville: p.ville }, link);
    const segments = smsSegments(message);

    if (!to) {
      results.push({ id: p.id, name: p.name, ok: false, error: "Numéro invalide" });
      continue;
    }

    if (dryRun) {
      results.push({ id: p.id, name: p.name, ok: true, to, segments });
      continue;
    }

    try {
      const msg = await client!.messages.create({ messagingServiceSid, to, body: message });
      results.push({ id: p.id, name: p.name, ok: true, to, segments, sid: msg.sid });
    } catch (e) {
      results.push({ id: p.id, name: p.name, ok: false, to, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const totalSegments = results.reduce((n, r) => n + (r.ok ? r.segments ?? 0 : 0), 0);
  return NextResponse.json({ dryRun, sent, failed: results.length - sent, totalSegments, results });
}
