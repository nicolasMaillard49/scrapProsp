import { NextRequest } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { toE164 } from "@/app/lib/sms";

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function xml(body = TWIML_EMPTY) {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/xml" } });
}

/**
 * Webhook Twilio (POST x-www-form-urlencoded) appelé quand un prospect répond.
 * - "OUI" / "OK" / "INTERESSE"  -> statut positive + note
 * - "STOP" (Twilio gère déjà l'opt-out côté Messaging Service) -> note
 * Nécessite une URL publique (donc l'app déployée) configurée dans Twilio.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return xml();

  const form = await req.formData();
  const from = String(form.get("From") ?? "");
  const text = String(form.get("Body") ?? "").trim().toUpperCase();
  if (!from) return xml();

  // Retrouve le prospect dont le numéro normalisé == From (E.164)
  const { data } = await supabase.from("prospects").select("id, phone, notes, status");
  const prospect = (data ?? []).find((p) => toE164(p.phone) === from);
  if (!prospect) return xml();

  const stamp = new Date().toISOString().slice(0, 10);
  const isYes = /\b(OUI|OK|INTERESSE|INTÉRESSÉ|YES)\b/.test(text);
  const isStop = /\b(STOP|ARRET|ARRÊT|DESABONNER)\b/.test(text);

  if (!isYes && !isStop) return xml();

  const tag = isYes ? `[SMS ${stamp}] Réponse OUI: "${text}"` : `[SMS ${stamp}] STOP`;
  const notes = prospect.notes ? `${prospect.notes}\n${tag}` : tag;

  await supabase
    .from("prospects")
    .update(isYes ? { status: "positive", notes } : { notes })
    .eq("id", prospect.id);

  return xml();
}
