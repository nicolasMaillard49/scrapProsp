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

/** Retire les accents (é -> e) pour rester en GSM-7 (sinon SMS x2/x3). */
function deburr(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** "Bonvalet" / "alexis bernard" -> "Bonvalet" / "Alexis Bernard" (gère les tirets). */
function frTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

/**
 * Salutation à partir du dirigeant SIRENE : "Bonjour Alexis Bonvalet".
 * Prend uniquement le 1er prénom, déburré (GSM-7). Null si pas de nom.
 * Pas de civilité (pas de champ genre en base) -> neutre.
 */
export function ownerSalutation(
  prenom?: string | null,
  nom?: string | null,
): string | null {
  const lastName = (nom ?? "").trim();
  if (!lastName) return null;
  const firstName = (prenom ?? "").trim().split(/\s+/)[0] ?? "";
  const parts = [firstName, lastName].filter(Boolean).map((w) => frTitleCase(deburr(w)));
  return `Bonjour ${parts.join(" ")}`;
}

/**
 * Message de prospection SMS (tunnel inversé).
 * - SANS accents (GSM-7) + mention STOP obligatoire (prospection B2B FR).
 * - Personnalisé "Monsieur Prénom Nom" si le dirigeant est connu, MAIS on
 *   retombe sur "Bonjour," si la version personnalisée dépasse 1 segment
 *   (nom long ou non-GSM7) -> garantit 1 SMS quand c'est possible.
 */
export function salesSmsMsg(p: SmsProspect, demoLink: string): string {
  const build = (greeting: string) =>
    `${greeting}NMF Agence vous a fait un apercu de site : ${demoLink} Interesse ? OUI. STOP pour arreter.`;

  const owner = ownerSalutation(p.dirigeant_prenom, p.dirigeant_nom);
  if (owner) {
    const personalized = build(`${owner}, `);
    if (smsSegments(personalized) <= 1) return personalized;
  }
  return build("Bonjour, ");
}
