import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { twilioClient, twilioConfigured, messagingServiceSid } from "@/app/lib/twilio";
import { toE164, smsSegments, isStopMessage } from "@/app/lib/sms";
import { logOutboundSms } from "@/app/lib/smsLog";

/** Base publique (env > origine de la requête) pour le statusCallback Twilio. */
function publicBase(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_DEMO_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  return req.nextUrl.origin;
}

/**
 * POST /api/sms/reply  { prospectId?, to, text, dryRun? }
 * Réponse en TEXTE LIBRE à un client dans une conversation existante.
 * Distinct de /api/sms (templates + bascule statut `sms_sent`) :
 * - ne bascule PAS le statut du prospect,
 * - aucune restriction horaire (réponse 1-1 sollicitée),
 * - garde-fou STOP : refus si le contact s'est désinscrit (légal + Twilio bloque).
 * dryRun=true => renvoie le message + segments sans rien envoyer (aperçu/coût).
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  }

  let body: { prospectId?: string | null; to?: string; text?: string; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const dryRun = body.dryRun === true;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const to = toE164(body.to);
  const prospectId = typeof body.prospectId === "string" ? body.prospectId : null;

  if (!text) {
    return NextResponse.json({ error: "Message vide" }, { status: 400 });
  }
  if (!to) {
    return NextResponse.json({ error: "Numéro invalide (mobile FR requis)" }, { status: 400 });
  }

  // Garde-fou STOP : on ne réécrit jamais à un contact désinscrit.
  const { data: inbound } = await supabase
    .from("sms_messages")
    .select("body")
    .eq("direction", "inbound")
    .eq("from_phone", to);
  if ((inbound ?? []).some((m) => isStopMessage(m.body))) {
    return NextResponse.json(
      { error: "Client désinscrit (STOP) — envoi interdit" },
      { status: 403 },
    );
  }

  const segments = smsSegments(text);

  if (dryRun) {
    return NextResponse.json({ ok: true, message: text, segments, dryRun: true });
  }

  if (!twilioConfigured) {
    return NextResponse.json(
      { error: "Twilio non configuré. Utilise dryRun:true pour tester." },
      { status: 503 },
    );
  }

  try {
    const base = publicBase(req);
    const msg = await twilioClient().messages.create({
      messagingServiceSid,
      to,
      body: text,
      statusCallback: `${base}/api/sms/status`,
    });
    await logOutboundSms({ prospectId, to, body: text, segments, sid: msg.sid });
    return NextResponse.json({
      ok: true,
      sid: msg.sid,
      segments,
      sentAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
