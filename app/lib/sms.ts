import { phoneForWhatsApp } from "./links";
import { metierLabel } from "@/app/maquette/templates/data";

/**
 * Numéro au format E.164 attendu par Twilio (ex. "+33612345678").
 * Réutilise la normalisation FR de phoneForWhatsApp (06… -> 336…).
 * Retourne null si le numéro ne ressemble pas à un mobile FR exploitable.
 */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phoneForWhatsApp(phone); // "33XXXXXXXXX"
  // SMS FR : mobiles uniquement (06/07 -> 336/337). On rejette fixes (01-05),
  // VoIP (09) et spéciaux : ils ne reçoivent pas de SMS -> évite le gaspillage.
  if (!/^33[67]\d{8}$/.test(digits)) return null;
  return `+${digits}`;
}

/**
 * Vrai si le corps d'un SMS entrant est une demande de désinscription (STOP).
 * Source de vérité partagée entre le webhook entrant et l'envoi de réponses :
 * on ne doit JAMAIS réécrire à un numéro qui a fait STOP (obligation légale,
 * Twilio bloque déjà l'envoi de son côté). Un simple « non merci » sans mot-clé
 * STOP n'est PAS un opt-out et reste répondable.
 */
export function isStopMessage(body: string | null | undefined): boolean {
  return /\b(STOP|ARRET|ARRÊT|DESABONNER|UNSUBSCRIBE)\b/i.test(body ?? "");
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
  greeting = "Bonjour",
): string | null {
  const firstName = (prenom ?? "").trim().split(/\s+/)[0] ?? "";
  if (!firstName) return null;
  return `${greeting} ${frTitleCase(firstName)}`;
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
  const metier = p.metier ? metierLabel(p.metier).toLowerCase() : "professionnel";
  const loc = p.ville && p.ville.trim() ? `à ${p.ville.trim()}` : "dans votre région";
  return (
    `${greeting}c'est Nicolas de NMF Agence. ` +
    `En cherchant un ${metier} ${loc}, j'ai remarqué que vous n'aviez pas de site web — ` +
    `j'ai pris le temps de vous créer un aperçu gratuit : ${demoLink}\n` +
    `Qu'en pensez-vous ? Répondez STOP pour ne plus être contacté.`
  );
}

/**
 * Message « livraison du site » — envoi unitaire depuis la fiche prospect, à un
 * contact avec qui l'accord de contact existe déjà. Ton chaleureux (tutoiement
 * léger « Salut »), sans mention STOP (l'opt-out reste géré par le Messaging
 * Service Twilio si le contact répond STOP). Avec accents (coût négligeable en unitaire).
 */
export function deliverySmsMsg(p: SmsProspect, demoLink: string): string {
  const owner = ownerSalutation(p.dirigeant_prenom, p.dirigeant_nom, "Salut");
  const greeting = owner ? `${owner}, ` : "Bonjour, ";
  return (
    `${greeting}c'est Nicolas de NMF Agence. ` +
    `Voici le site que je vous ai préparé : ${demoLink} — ` +
    `dites-moi ce que vous en pensez !`
  );
}

/**
 * Lien de prise de RDV (Koalendar). Source de vérité unique : réutilisé par le
 * SMS « réserver un créneau » et par le modèle de réponse rapide du composer.
 */
export const KOALENDAR_URL = "https://koalendar.com/e/reunion-nicolas-maillard";

/**
 * Message « prise de RDV » — envoi unitaire depuis la fiche prospect, à un
 * contact déjà engagé. Propose de réserver un créneau (site web ou Google Ads)
 * via Koalendar. Ton chaleureux, sans mention STOP (opt-out géré par le
 * Messaging Service Twilio si le contact répond STOP).
 */
export function meetingSmsMsg(p: SmsProspect): string {
  const owner = ownerSalutation(p.dirigeant_prenom, p.dirigeant_nom, "Salut");
  const greeting = owner ? `${owner}, ` : "Bonjour, ";
  return (
    `${greeting}c'est Nicolas de NMF Agence. ` +
    `Pour échanger sur votre projet (nouveau site web ou campagne Google Ads), ` +
    `réservez le créneau qui vous arrange ici : ${KOALENDAR_URL}`
  );
}
