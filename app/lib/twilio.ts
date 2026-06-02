import twilio from "twilio";

const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
const token = process.env.TWILIO_AUTH_TOKEN ?? "";

/** SID du Messaging Service Twilio (gère l'expéditeur + l'opt-out STOP). */
export const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID ?? "";

/** Vrai si toutes les variables Twilio nécessaires à l'envoi sont présentes. */
export const twilioConfigured = !!(sid && token && messagingServiceSid);

/** Client Twilio (ne pas appeler si !twilioConfigured). */
export function twilioClient() {
  if (!twilioConfigured) throw new Error("Twilio non configuré (TWILIO_* manquants)");
  return twilio(sid, token);
}
