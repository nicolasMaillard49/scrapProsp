import { supabase } from "./supabase";

/**
 * Journalisation des SMS dans la table `sms_messages` (source de vérité du suivi).
 * Les inserts sont NON bloquants : un échec de log ne doit jamais casser l'envoi
 * réel ni la réponse au webhook Twilio. On loggue l'erreur et on continue.
 */

export interface OutboundLog {
  prospectId: string | null;
  to: string;
  body: string;
  segments: number;
  sid: string;
  /** Statut Twilio à l'envoi (par défaut "sent"). */
  status?: string;
}

export async function logOutboundSms(m: OutboundLog): Promise<void> {
  try {
    await supabase.from("sms_messages").insert({
      prospect_id: m.prospectId,
      twilio_sid: m.sid,
      direction: "outbound",
      to_phone: m.to,
      body: m.body,
      segments: m.segments,
      status: m.status ?? "sent",
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[smsLog] outbound insert failed:", e);
  }
}

/**
 * Bascule un prospect de `todo` vers `sms_sent` après l'envoi réussi d'un SMS,
 * pour qu'il sorte de la liste « à appeler » et ne soit pas recontacté.
 * Garde-fou `.eq("status","todo")` : on n'écrase jamais un statut déjà qualifié
 * (positive/negative/called/no_answer). Non bloquant.
 */
export async function markProspectSmsSent(prospectId: string | null): Promise<void> {
  if (!prospectId) return;
  try {
    await supabase
      .from("prospects")
      .update({ status: "sms_sent" })
      .eq("id", prospectId)
      .eq("status", "todo");
  } catch (e) {
    console.error("[smsLog] mark sms_sent failed:", e);
  }
}

export interface InboundLog {
  prospectId: string | null;
  from: string;
  body: string;
  /** MessageSid Twilio (unique) — peut être absent selon la source. */
  sid?: string | null;
  status?: string;
  /** 'positive' | 'negative' | 'neutral' | null (à classer). */
  sentiment?: string | null;
  /** 'ai' | 'keyword' | 'manual'. */
  sentimentSource?: string | null;
}

export async function logInboundSms(m: InboundLog): Promise<void> {
  try {
    await supabase.from("sms_messages").insert({
      prospect_id: m.prospectId,
      twilio_sid: m.sid ?? null,
      direction: "inbound",
      from_phone: m.from,
      body: m.body,
      status: m.status ?? "received",
      sentiment: m.sentiment ?? null,
      sentiment_source: m.sentimentSource ?? null,
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[smsLog] inbound insert failed:", e);
  }
}
