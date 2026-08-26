import { twilioClient, twilioConfigured, messagingServiceSid } from "./twilio";
import { toE164, smsSegments } from "./sms";
import { logOutboundSms } from "./smsLog";

/**
 * Envoi d'un SMS de notification interne — pas de prospection.
 *
 * Troisième voie à côté de `notify.ts` (Telegram, qui va à l'agence) et de
 * `email.ts` (Resend). Même contrat que ces deux-là : sans configuration, c'est
 * un no-op silencieux, jamais une exception. Une notification ratée ne doit
 * jamais faire échouer ce qui l'a déclenchée.
 *
 * Pourquoi le SMS : un artisan dans son atelier, scie en main, ne lit pas ses
 * mails de la journée. Il sent son téléphone vibrer. Sur une demande de devis,
 * le délai de rappel est ce qui décide face au concurrent qui a rappelé avant.
 *
 * Différence avec `/api/sms` (prospection) : pas de mention STOP. Le
 * destinataire est le client lui-même, qui a demandé à être prévenu ; ce n'est
 * pas de la sollicitation commerciale et l'opt-out reste géré par le Messaging
 * Service Twilio s'il répond STOP malgré tout.
 */

export const smsConfigured = twilioConfigured;

export interface SendSmsInput {
  /** Numéro du destinataire, dans n'importe quel format FR. */
  to: string;
  body: string;
  /** URL du webhook de statut Twilio, si on veut suivre la remise. */
  statusCallback?: string;
}

export interface SendSmsResult {
  ok: boolean;
  sid?: string;
  segments?: number;
  error?: string;
  skipped?: boolean;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  if (!twilioConfigured) return { ok: false, skipped: true, error: "TWILIO_* manquants" };

  /* `toE164` refuse les fixes, la VoIP et les numéros spéciaux : ils ne
     reçoivent pas de SMS. Un numéro d'atelier en 01 est donc écarté ici, avant
     de facturer un envoi qui n'arriverait jamais. */
  const to = toE164(input.to);
  if (!to) return { ok: false, error: `numéro non joignable par SMS : ${input.to}` };

  const segments = smsSegments(input.body);

  try {
    const msg = await twilioClient().messages.create({
      messagingServiceSid,
      to,
      body: input.body,
      ...(input.statusCallback ? { statusCallback: input.statusCallback } : {}),
    });
    /* Journalisé sans prospect : ce SMS ne s'adresse pas à un prospect de la
       base de prospection, mais à un client. La colonne accepte NULL. */
    await logOutboundSms({ prospectId: null, to, body: input.body, segments, sid: msg.sid });
    return { ok: true, sid: msg.sid, segments };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
