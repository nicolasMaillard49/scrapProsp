import { NextRequest } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { toE164 } from "@/app/lib/sms";

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function xml(body = TWIML_EMPTY) {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/xml" } });
}

/**
 * Webhook Twilio (POST x-www-form-urlencoded) appelé quand un prospect répond.
 * - "STOP/ARRET/..." -> note d'opt-out (Twilio gère déjà la désinscription).
 * - TOUTE autre réponse -> statut `positive` + note avec le texte exact
 *   (un humain qui répond = lead à traiter ; on ne rate aucune intention,
 *    même "d'accord ça m'intéresse", "c'est combien ?", "rappelez-moi"...).
 * Nécessite une URL publique (app déployée) configurée dans Twilio.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return xml();

  const form = await req.formData();
  const from = String(form.get("From") ?? "");
  const body = String(form.get("Body") ?? "").trim();
  if (!from || !body) return xml();

  // Retrouve le prospect dont le numéro normalisé == From (E.164)
  const { data } = await supabase.from("prospects").select("id, phone, notes, status");
  const prospect = (data ?? []).find((p) => toE164(p.phone) === from);
  if (!prospect) return xml();

  const stamp = new Date().toISOString().slice(0, 10);
  const isStop = /\b(STOP|ARRET|ARRÊT|DESABONNER|UNSUBSCRIBE)\b/i.test(body);

  const tag = isStop
    ? `[SMS ${stamp}] STOP (opt-out)`
    : `[SMS ${stamp}] Réponse: "${body}"`;
  const notes = prospect.notes ? `${prospect.notes}\n${tag}` : tag;

  // STOP : on logue sans marquer positif. Sinon : tout répondeur -> positive.
  await supabase
    .from("prospects")
    .update(isStop ? { notes } : { status: "positive", notes })
    .eq("id", prospect.id);

  return xml();
}
