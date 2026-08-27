/**
 * Demandes de devis venues des landing pages Google Ads.
 *
 * Ce module ne contient que du calcul pur — validation, normalisation, mise en
 * forme. Les accès à Supabase et à Google Ads vivent dans les routes et dans
 * `googleAds/conversions.ts`, pour que tout ceci reste testable sans réseau.
 */

/** Paramètres ValueTrack posés par le modèle de suivi de la campagne. */
export const TRACKED = ["gclid", "ag", "kw", "mt", "dev", "loc", "camp"] as const;

export interface LeadInput {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  commune?: unknown;
  message?: unknown;
  service?: unknown;
  client?: unknown;
  tracking?: unknown;
}

export interface LeadRow {
  client_slug: string;
  name: string;
  phone: string;
  email: string | null;
  commune: string | null;
  message: string;
  service: string | null;
  gclid: string | null;
  ag: string | null;
  kw: string | null;
  mt: string | null;
  device: string | null;
  loc: string | null;
  camp: string | null;
  landing: string | null;
  referrer: string | null;
  token: string;
}

/**
 * Un numéro français, fixe ou mobile, quel que soit le formatage saisi, ramené
 * en +33… — le seul format que Twilio accepte pour la notification SMS.
 * Renvoie null si ce n'est pas un numéro français valide.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+33[1-9]\d{8}$/.test(digits)) return digits;
  if (/^0[1-9]\d{8}$/.test(digits)) return `+33${digits.slice(1)}`;
  if (/^33[1-9]\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

/** Coupe une chaîne libre, sans jamais planter sur autre chose qu'une chaîne. */
function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** `null` plutôt que chaîne vide : une colonne vide se lit mieux que "". */
function optional(v: unknown, max: number): string | null {
  return text(v, max) || null;
}

/**
 * Le jeton du lien de qualification. Il ne doit rien porter de devinable :
 * l'artisan transfère parfois son e-mail, et un jeton séquentiel laisserait
 * lire les demandes du voisin.
 */
export function makeToken(random: () => number = Math.random): string {
  const A = "abcdefghijkmnopqrstuvwxyz23456789"; // ni l/1 ni o/0, il le lit parfois à voix haute
  let out = "";
  for (let i = 0; i < 24; i++) out += A[Math.floor(random() * A.length)];
  return out;
}

/** Les colonnes de suivi, communes à une demande de devis et à un appel. */
export interface TrackingColumns {
  gclid: string | null;
  ag: string | null;
  kw: string | null;
  mt: string | null;
  device: string | null;
  loc: string | null;
  camp: string | null;
  landing: string | null;
  referrer: string | null;
}

/**
 * Le ticket de clic Google Ads, mis en forme pour la base.
 *
 * Partagé par `parseLead` et par l'enregistrement d'un appel : les deux
 * écrivent exactement le même ticket, et c'est lui qui rend la conversion à
 * Google. Deux copies auraient fini par diverger sur un plafond de longueur.
 */
export function parseTracking(raw: unknown): TrackingColumns {
  const t = (raw ?? {}) as Record<string, unknown>;
  return {
    gclid: optional(t.gclid, 512),
    ag: optional(t.ag, 40),
    kw: optional(t.kw, 200),
    mt: optional(t.mt, 20),
    device: optional(t.dev, 20),
    loc: optional(t.loc, 40),
    camp: optional(t.camp, 40),
    landing: optional(t.landing, 200),
    referrer: optional(t.referrer, 500),
  };
}

export type ParseResult =
  | { ok: true; row: LeadRow }
  | { ok: false; status: 400 | 422; error: string };

/**
 * Valide et met en forme une demande reçue d'une landing page.
 *
 * Volontairement tolérant sur tout ce qui n'est pas indispensable : une commune
 * absente ou un `gclid` manquant n'est pas une raison de refuser un lead. On
 * n'exige que ce sans quoi l'artisan ne peut pas rappeler.
 */
export function parseLead(body: LeadInput, slug: string, token = makeToken()): ParseResult {
  const name = text(body.name, 120);
  const rawPhone = text(body.phone, 40);
  const message = text(body.message, 4000);

  if (!name || !rawPhone || !message) {
    return { ok: false, status: 422, error: "Nom, téléphone et description du projet sont obligatoires" };
  }
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, status: 422, error: "Numéro de téléphone invalide" };

  return {
    ok: true,
    row: {
      client_slug: slug,
      name,
      phone,
      email: optional(body.email, 180),
      commune: optional(body.commune, 120),
      message,
      service: optional(body.service, 80),
      ...parseTracking(body.tracking),
      token,
    },
  };
}

/** Le message Telegram envoyé à la réception. Une seule ligne par information. */
export function leadNotification(row: LeadRow, label: string, qualifyUrl: string): string {
  const lignes = [
    `<b>${escapeHtml(label)} — nouvelle demande</b>`,
    `${escapeHtml(row.name)} · ${escapeHtml(row.phone)}`,
    row.commune ? `Commune : ${escapeHtml(row.commune)}` : null,
    row.service ? `Service : ${escapeHtml(row.service)}` : null,
    row.kw ? `Mot-clé : ${escapeHtml(row.kw)}` : null,
    row.gclid ? null : `⚠️ sans gclid — cette demande ne sera pas attribuable`,
    "",
    escapeHtml(row.message.slice(0, 500)),
    "",
    `Devis signé ? → ${qualifyUrl}`,
  ];
  return lignes.filter((l) => l !== null).join("\n");
}

/** Un segment SMS en GSM-7. Au-delà, l'opérateur découpe et facture double. */
const SEGMENT_GSM7 = 160;

/**
 * La même demande, en SMS. Volontairement plus courte que la version Telegram :
 * on vise un seul segment, donc pas de message du client, pas de mot-clé, pas
 * d'avertissement gclid. Le SMS sert à faire décrocher vite ; le détail est
 * dans le mail et dans Telegram.
 *
 * Le numéro reste au format +33… : c'est celui que le téléphone rend cliquable.
 *
 * La limite est désormais TENUE, pas seulement souhaitée. Le message type fait
 * 155 caractères : il ne restait que cinq caractères de marge, et un nom
 * composé suivi d'une commune à rallonge la dépassait sans que rien ne le
 * signale — le SMS partait en deux morceaux, facturés deux fois, le lien coupé
 * au milieu dans certains combinés.
 *
 * L'ordre des sacrifices suit ce que le SMS sert à faire. On rappelle : le
 * numéro et le lien ne se coupent jamais. La commune part la première — elle
 * est dans le mail, et elle ne sert qu'à situer. Le nom est raccourci en
 * dernier recours, jamais supprimé : c'est lui qui permet de dire « bonjour
 * madame Untel » en décrochant.
 */
export function leadSmsNotification(row: LeadRow, label: string, qualifyUrl: string): string {
  const composer = (identite: string) =>
    `${label} - nouvelle demande de devis\n` +
    `${identite}\n` +
    `${row.phone}\n` +
    `Devis signe ? ${qualifyUrl}`;

  const complet = row.commune ? `${row.name}, ${row.commune}` : row.name;
  if (composer(complet).length <= SEGMENT_GSM7) return composer(complet);

  if (composer(row.name).length <= SEGMENT_GSM7) return composer(row.name);

  const marge = SEGMENT_GSM7 - composer("").length;
  return composer(row.name.slice(0, Math.max(0, marge)).trimEnd());
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Le format de date que Google Ads exige à l'import : « yyyy-MM-dd HH:mm:ss+TZ ».
 * Un ISO 8601 nu est refusé — il manque le décalage explicite.
 */
export function googleAdsDateTime(d: Date, offsetMinutes = 120): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return (
    `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())} ` +
    `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}` +
    `${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`
  );
}

/** Le décalage de Paris pour une date donnée : +2 h en heure d'été, +1 h sinon. */
export function parisOffsetMinutes(d: Date): number {
  const jan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const jul = new Date(Date.UTC(d.getUTCFullYear(), 6, 1));
  const off = (x: Date) => {
    const s = x.toLocaleString("en-US", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" });
    const m = s.match(/GMT([+-]\d+)/);
    return m ? Number(m[1]) * 60 : 60;
  };
  const now = (() => {
    const s = d.toLocaleString("en-US", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" });
    const m = s.match(/GMT([+-]\d+)/);
    return m ? Number(m[1]) * 60 : null;
  })();
  return now ?? Math.max(off(jan), off(jul));
}
