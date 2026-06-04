import { NextRequest } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { toE164 } from "@/app/lib/sms";
import { logInboundSms } from "@/app/lib/smsLog";

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
  const messageSid = String(form.get("MessageSid") ?? "") || null;
  if (!from || !body) return xml();

  // Retrouve le prospect dont le numéro normalisé == From (E.164)
  const { data } = await supabase.from("prospects").select("id, phone, notes, status");
  const prospect = (data ?? []).find((p) => toE164(p.phone) === from);

  const isStop = /\b(STOP|ARRET|ARRÊT|DESABONNER|UNSUBSCRIBE)\b/i.test(body);

  // Journal SMS : ligne entrante. STOP -> negative (mot-clé), sinon à classer (null).
  await logInboundSms({
    prospectId: prospect?.id ?? null,
    from,
    body,
    sid: messageSid,
    status: "received",
    sentiment: isStop ? "negative" : null,
    sentimentSource: isStop ? "keyword" : null,
  });

  // Pas de prospect connu (numéro inconnu) : on a quand même loggé la réponse.
  if (!prospect) return xml();

  const stamp = new Date().toISOString().slice(0, 10);
  const tag = isStop
    ? `[SMS ${stamp}] STOP (opt-out)`
    : `[SMS ${stamp}] Réponse: "${body}"`;
  const notes = prospect.notes ? `${prospect.notes}\n${tag}` : tag;

  // STOP -> prospect 'negative' (exclus). Sinon : tout répondeur -> 'positive'
  // (lead à regarder ; le classement IA pourra le repasser en 'negative').
  await supabase
    .from("prospects")
    .update(isStop ? { status: "negative", notes } : { status: "positive", notes })
    .eq("id", prospect.id);

  return xml();
}
