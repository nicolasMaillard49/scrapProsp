import { phoneForWhatsApp } from "./links";

/**
 * Numéro au format E.164 attendu par Twilio (ex. "+33612345678").
 * Réutilise la normalisation FR de phoneForWhatsApp (06… -> 336…).
 * Retourne null si le numéro ne ressemble pas à un mobile FR exploitable.
 */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phoneForWhatsApp(phone); // "33XXXXXXXXX"
  // FR : 33 + 9 chiffres = 11 ; on veut surtout des mobiles (6/7) pour le SMS
  if (!/^33\d{9}$/.test(digits)) return null;
  return `+${digits}`;
}

const GSM7_EXT = "^{}\\[~]|€";

/**
 * Vrai si le texte tient dans l'alphabet GSM-7 (sinon Twilio bascule en UCS-2,
 * segments de 70 caractères au lieu de 160 -> facture x2/x3).
 * Pratique : on veut un message SANS accents.
 */
export function isGsm7(text: string): boolean {
  const gsm7 =
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
  for (const ch of text) {
    if (!gsm7.includes(ch) && !GSM7_EXT.includes(ch)) return false;
  }
  return true;
}

/** Nombre de SMS facturés pour ce texte (1 = un seul SMS). */
export function smsSegments(text: string): number {
  const gsm = isGsm7(text);
  // les caractères d'extension comptent double en GSM-7
  const len = gsm
    ? [...text].reduce((n, ch) => n + (GSM7_EXT.includes(ch) ? 2 : 1), 0)
    : [...text].length;
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return len <= single ? 1 : Math.ceil(len / multi);
}

export interface SmsProspect {
  name: string;
  metier: string;
  ville: string;
  /** Champs dirigeant SIRENE (optionnels) pour personnaliser la salutation. */
  dirigeant_prenom?: string | null;
  dirigeant_nom?: string | null;
}

/** "BONVALET" / "alexis bernard" -> "Bonvalet" / "Alexis Bernard" (gère tirets + accents). */
function frTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s-])([a-zà-ÿ])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

/**
 * Salutation à partir du dirigeant SIRENE : "Bonjour Alexis".
 * 1er prénom seulement (ton plus personnel, moins "fichage"), accents conservés.
 * Null si pas de prénom -> "Bonjour," générique. Pas de civilité (pas de genre en base).
 */
export function ownerSalutation(
  prenom?: string | null,
  nom?: string | null,
): string | null {
  const firstName = (prenom ?? "").trim().split(/\s+/)[0] ?? "";
  if (!firstName) return null;
  return `Bonjour ${frTitleCase(firstName)}`;
}

/**
 * Message de prospection SMS (tunnel inversé).
 * Ton volontairement humain/personnel (et non commercial) pour éviter l'effet
 * spam : on explique pourquoi on écrit (pas de site repéré) et on offre la démo
 * déjà faite. AVEC accents -> UCS-2 (plusieurs segments assumés).
 * Opt-out : ligne "répondez STOP" en fin de message (+ interception STOP/ARRET
 * par le Messaging Service Twilio).
 */
export function salesSmsMsg(p: SmsProspect, demoLink: string): string {
  const owner = ownerSalutation(p.dirigeant_prenom, p.dirigeant_nom);
  const greeting = owner ? `${owner}, ` : "Bonjour, ";
  return (
    `${greeting}c'est Nicolas de NMF Agence. ` +
    `Vous n'avez pas de site web pour votre activité — ` +
    `j'ai créé un aperçu gratuit pour vous : ${demoLink}\n` +
    `Qu'en pensez-vous ? Répondez STOP pour ne plus être contacté.`
  );
}
