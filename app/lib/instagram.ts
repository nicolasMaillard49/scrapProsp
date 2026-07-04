// Logique de qualification + personnalisation des prospects Instagram.
// Fonctions PURES (réutilisables côté serveur ET client). Pas d'import serveur ici.

import type { IgProfile } from "./apify";

/* ────────────────────────────────────────────────────────────
 * Filtre « pas de vrai site web »
 * Un compte est un prospect si son lien est vide OU pointe vers un
 * agrégateur / une plateforme de réservation / un réseau social
 * (Linktree, Planity, Treatwell, wa.me, instagram, facebook…) —
 * ce ne sont PAS de vrais sites, c'est même un argument de vente.
 * ──────────────────────────────────────────────────────────── */
const AGGREGATOR_HOSTS = [
  "linktr.ee", "linktree", "beacons.ai", "beacons.page", "taplink", "lnk.bio",
  "linkin.bio", "linktw.in", "campsite.bio", "bio.link", "msha.ke", "withkoji",
  "planity.com", "treatwell", "fresha.com", "booksy.com", "kiute", "flowkey",
  "wa.me", "whatsapp.com", "instagram.com", "facebook.com", "fb.me", "fb.com",
  "m.me", "tiktok.com", "snapchat.com", "youtube.com", "g.page", "goo.gl",
  "business.google.com", "maps.app.goo.gl", "deliveroo", "ubereats", "thefork", "lafourchette",
];

function hostOf(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Vrai si l'URL est un VRAI site (domaine propre), donc le compte est à écarter. */
export function hasRealWebsite(externalUrl: string | null | undefined): boolean {
  if (!externalUrl || !externalUrl.trim()) return false;
  const host = hostOf(externalUrl);
  if (!host) return false;
  return !AGGREGATOR_HOSTS.some((agg) => host === agg || host.endsWith(`.${agg}`) || host.includes(agg));
}

/** Extrait les URLs présentes dans un texte libre (bio). */
const URL_RE = /https?:\/\/[^\s),]+|(?:www\.)[^\s),]+|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:fr|com|net|org|io|co|shop|pro|site|online|store|beauty|hair|ink|studio|art|salon|eu|be|ch|de|es|it|pt|uk|re|gp|mq|nc|pf|yt)(?:\/[^\s),]*)?/gi;

function extractUrlsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(URL_RE)].map((m) => m[0]);
}

/** Vrai si le profil est un prospect (pas de vrai site). */
export function isProspect(profile: IgProfile): boolean {
  // Vérifie le lien officiel du profil
  if (hasRealWebsite(profile.externalUrl)) return false;
  // Vérifie aussi les URLs mentionnées dans la bio
  const bioUrls = extractUrlsFromText(profile.biography);
  return !bioUrls.some((url) => hasRealWebsite(url));
}

/* ────────────────────────────────────────────────────────────
 * Déduction de la niche (metier) — depuis catégorie business + bio.
 * Renvoie un code aligné sur les kits de template (nicheKits.ts).
 * ──────────────────────────────────────────────────────────── */
type Niche =
  | "coiffeur" | "restaurant" | "estheticienne" | "fleuriste" | "tatoueur"
  | "menuisier" | "paysagiste" | "carreleur" | "peintre" | "macon" | "couvreur"
  | "charpentier" | "ferronnier" | "plaquiste" | "cuisiniste" | "plombier"
  | "electricien" | "chauffagiste" | "";

const NICHE_RULES: { niche: Exclude<Niche, "">; re: RegExp }[] = [
  { niche: "coiffeur", re: /(coiff|barbi|barber|\bhair\b|hairdress|hairstyl|coloris|salon de coiff)/i },
  { niche: "restaurant", re: /(restaur|resto|bistrot|brasserie|pizz|burger|traiteur|cuisine|chef|food|caf[eé]|coffee|sushi|tacos|kebab|cr[eê]perie)/i },
  { niche: "estheticienne", re: /(esth[eé]|institut|beaut|beauty|cosmetic|ongl|nail|spa|maquill|makeup|[eé]pil|cils|lash|sourcil|massage|bien-?[eê]tre)/i },
  { niche: "fleuriste", re: /(fleurist|fleurs|floral|florist|bouquet)/i },
  { niche: "tatoueur", re: /(tatou|tattoo|\bink\b|piercing)/i },
  // Artisans du bâtiment (ordre : du plus spécifique au plus générique)
  { niche: "menuisier", re: /(menuis|[eé]b[eé]nist|agencement|mobilier sur[- ]?mesure|travail du bois)/i },
  { niche: "paysagiste", re: /(paysag|jardinier|am[eé]nagement (ext[eé]rieur|paysager)|espaces? verts?|[eé]lagage)/i },
  { niche: "carreleur", re: /(carrel|fa[iï]ence|mosa[iï]que)/i },
  { niche: "couvreur", re: /(couvreur|couverture|toiture|zingu|ardoise|tuile)/i },
  { niche: "charpentier", re: /(charpent|ossature bois)/i },
  { niche: "ferronnier", re: /(ferronn|m[eé]tallerie|m[eé]tallier|serrur|garde[- ]?corps|portail)/i },
  { niche: "plaquiste", re: /(plaquiste|pl[aâ]trier|placo|pl[aâ]trerie|cloison)/i },
  { niche: "cuisiniste", re: /(cuisiniste|cuisines? sur[- ]?mesure|am[eé]nagement de cuisine)/i },
  { niche: "plombier", re: /(plombier|plomberie|sanitaire|salle de bain)/i },
  { niche: "electricien", re: /([eé]lectricien|[eé]lectricit[eé]|domotique)/i },
  { niche: "chauffagiste", re: /(chauffag|pompe [aà] chaleur|\bpac\b|climatisation|clim\b)/i },
  { niche: "macon", re: /(ma[cç]on|gros [oœ]uvre|pierre de taille|terrass)/i },
  { niche: "peintre", re: /(peintre|peinture (int[eé]rieure|ext[eé]rieure|d[eé]co)|d[eé]corat)/i },
];

export function detectMetier(category?: string | null, bio?: string | null): Niche {
  const hay = `${category ?? ""} ${bio ?? ""}`;
  for (const { niche, re } of NICHE_RULES) {
    if (re.test(hay)) return niche;
  }
  return "";
}

/* ────────────────────────────────────────────────────────────
 * Déduction de la ville — depuis le hashtag puis la bio.
 * Liste de villes FR courantes (+ agglo bordelaise, zone cible).
 * ──────────────────────────────────────────────────────────── */
const CITIES = [
  "bordeaux", "merignac", "pessac", "talence", "begles", "gradignan", "villenave",
  "libourne", "arcachon", "lormont", "cenon", "floirac", "bruges", "eysines", "le bouscat",
  "paris", "lyon", "marseille", "toulouse", "nantes", "nice", "montpellier", "strasbourg",
  "lille", "rennes", "reims", "angers", "nancy", "metz", "tours", "biarritz", "bayonne",
  "agen", "perigueux", "bergerac", "saintes", "cognac", "angouleme", "poitiers", "limoges",
];

function cap(s: string): string {
  return s.replace(/(^|[\s-])([a-zà-ÿ])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

export function detectVille(hashtag?: string | null, bio?: string | null): string {
  const tag = (hashtag ?? "").toLowerCase().replace(/[^a-zà-ÿ]/g, "");
  for (const c of CITIES) {
    if (tag.includes(c.replace(/[^a-zà-ÿ]/g, ""))) return cap(c);
  }
  const b = (bio ?? "").toLowerCase();
  for (const c of CITIES) {
    if (new RegExp(`\\b${c}\\b`, "i").test(b)) return cap(c);
  }
  return "";
}

/* ────────────────────────────────────────────────────────────
 * Génération du DM (tutoiement, 2 variantes : avec lien / tease).
 * ──────────────────────────────────────────────────────────── */
const NICHE_COPY: Record<string, { intro: (loc: string) => string; hook: string; value: string }> = {
  coiffeur: { intro: (l) => `En cherchant des coiffeurs ${l}, je suis tombé sur ton salon`, hook: "ton feed donne envie", value: "la prise de RDV en ligne" },
  restaurant: { intro: (l) => `En cherchant des restos ${l}, je suis tombé sur ton compte`, hook: "ça donne faim 😋", value: "le menu et les réservations en ligne" },
  estheticienne: { intro: (l) => `En cherchant des instituts ${l}, je suis tombé sur ton compte`, hook: "ton univers donne envie de prendre soin de soi", value: "la prise de RDV en ligne" },
  fleuriste: { intro: (l) => `En cherchant des fleuristes ${l}, je suis tombé sur ta boutique`, hook: "tes compositions sont superbes", value: "une vitrine et les commandes en ligne" },
  tatoueur: { intro: (l) => `En cherchant des tatoueurs ${l}, je suis tombé sur ton compte`, hook: "ton travail est impressionnant", value: "un book en ligne et les demandes de RDV" },
  menuisier: { intro: (l) => `En cherchant des menuisiers ${l}, je suis tombé sur ton compte`, hook: "tes réalisations sont super propres", value: "un site qui présente tes chantiers et ramène des demandes de devis" },
  paysagiste: { intro: (l) => `En cherchant des paysagistes ${l}, je suis tombé sur ton compte`, hook: "tes aménagements rendent vraiment bien", value: "un site qui met en avant tes réalisations et ramène des demandes de devis" },
  carreleur: { intro: (l) => `En cherchant des carreleurs ${l}, je suis tombé sur ton compte`, hook: "tes poses sont nickel", value: "un site qui présente tes chantiers et ramène des demandes de devis" },
  peintre: { intro: (l) => `En cherchant des peintres ${l}, je suis tombé sur ton compte`, hook: "tes finitions rendent super bien", value: "un site qui présente tes chantiers et ramène des demandes de devis" },
  macon: { intro: (l) => `En cherchant des maçons ${l}, je suis tombé sur ton compte`, hook: "tes chantiers sont impressionnants", value: "un site qui présente tes réalisations et ramène des demandes de devis" },
  couvreur: { intro: (l) => `En cherchant des couvreurs ${l}, je suis tombé sur ton compte`, hook: "tes avant/après parlent d'eux-mêmes", value: "un site qui présente tes chantiers et ramène des demandes de devis" },
  charpentier: { intro: (l) => `En cherchant des charpentiers ${l}, je suis tombé sur ton compte`, hook: "ton travail du bois est superbe", value: "un site qui présente tes réalisations et ramène des demandes de devis" },
  ferronnier: { intro: (l) => `En cherchant des ferronniers ${l}, je suis tombé sur ton compte`, hook: "tes pièces sont magnifiques", value: "un site vitrine qui présente ton travail et ramène des commandes" },
  plaquiste: { intro: (l) => `En cherchant des plaquistes ${l}, je suis tombé sur ton compte`, hook: "tes chantiers sont propres", value: "un site qui présente tes réalisations et ramène des demandes de devis" },
  cuisiniste: { intro: (l) => `En cherchant des cuisinistes ${l}, je suis tombé sur ton compte`, hook: "tes cuisines rendent super bien", value: "un site qui présente tes réalisations et ramène des projets" },
  plombier: { intro: (l) => `En cherchant des plombiers ${l}, je suis tombé sur ton compte`, hook: "tes interventions sont propres", value: "un site qui ramène des demandes de dépannage et de devis" },
  electricien: { intro: (l) => `En cherchant des électriciens ${l}, je suis tombé sur ton compte`, hook: "tes installs sont nickel", value: "un site qui ramène des demandes d'intervention et de devis" },
  chauffagiste: { intro: (l) => `En cherchant des chauffagistes ${l}, je suis tombé sur ton compte`, hook: "tes installations sont propres", value: "un site qui ramène des demandes de devis" },
  "": { intro: (l) => `Je suis tombé sur ton compte ${l}`, hook: "j'ai bien aimé ce que tu fais", value: "une vraie présence en ligne" },
};

/* ────────────────────────────────────────────────────────────
 * Détection booking platform (Planity, Treatwell, Fresha…)
 * ──────────────────────────────────────────────────────────── */
const BOOKING_HOSTS = ["planity.com", "treatwell", "fresha.com", "booksy.com", "kiute", "flowkey"];

/** Détecte si le profil utilise une plateforme de réservation (lien profil + bio). */
export function detectBookingPlatform(externalUrl: string | null | undefined, bio: string | null | undefined): string | null {
  const urls = [externalUrl, ...extractUrlsFromText(bio)].filter(Boolean) as string[];
  for (const url of urls) {
    const host = hostOf(url);
    if (!host) continue;
    for (const bk of BOOKING_HOSTS) {
      if (host === bk || host.endsWith(`.${bk}`) || host.includes(bk)) {
        if (bk.includes("planity")) return "Planity";
        if (bk.includes("treatwell")) return "Treatwell";
        if (bk.includes("fresha")) return "Fresha";
        if (bk.includes("booksy")) return "Booksy";
        return bk;
      }
    }
  }
  return null;
}

/* ────────────────────────────────────────────────────────────
 * Extraction de contact (cœur « IG email extractor ») — email + téléphone
 * depuis les champs business de l'actor ET depuis le texte de la bio.
 * ──────────────────────────────────────────────────────────── */
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Téléphones FR : 0X xx xx xx xx, +33 X…, séparateurs variés (espace, ., -, /).
const PHONE_FR_RE = /(?:(?:\+33|0033)\s?[1-9]|0[1-9])(?:[\s.\-/]?\d{2}){4}/g;

/** Emails trouvés dans un texte (bio), dédupliqués, en minuscules. */
export function extractEmails(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = [...text.matchAll(EMAIL_RE)].map((m) => m[0].toLowerCase());
  return Array.from(new Set(found));
}

/** Numéros FR trouvés dans un texte, normalisés en `0X XX XX XX XX`. */
export function extractPhonesFr(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(PHONE_FR_RE)) {
    let digits = m[0].replace(/[^\d+]/g, "");
    digits = digits.replace(/^(?:\+33|0033)/, "0"); // format national
    if (digits.length === 10 && digits.startsWith("0")) {
      out.add(digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim());
    }
  }
  return Array.from(out);
}

/**
 * Email + téléphone d'un profil : priorité aux champs business de l'actor (alias
 * multiples), repli sur la bio. C'est ce qui alimente le CSV « max d'infos ».
 */
export function pickContact(profile: {
  public_email?: string | null;
  businessEmail?: string | null;
  public_phone_number?: string | null;
  businessPhoneNumber?: string | null;
  contactPhoneNumber?: string | null;
  biography?: string | null;
}): { email: string | null; phone: string | null } {
  const fieldEmail = (profile.public_email || profile.businessEmail || "").trim().toLowerCase() || null;
  const fieldPhone = (profile.public_phone_number || profile.businessPhoneNumber || profile.contactPhoneNumber || "").trim() || null;
  const email = fieldEmail || extractEmails(profile.biography)[0] || null;
  const phone = fieldPhone || extractPhonesFr(profile.biography)[0] || null;
  return { email, phone };
}

export interface IgDmInput {
  metier: string;
  ville: string;
  bookingPlatform?: string | null;
}

export interface IgDmVariants {
  withLink: string;
  tease: string;
}

/** Construit les 2 variantes de DM personnalisées. `demoLink` = aperçu /di/<code>. */
export function instagramDmMsg(p: IgDmInput, demoLink: string): IgDmVariants {
  const copy = NICHE_COPY[p.metier] ?? NICHE_COPY[""];
  const loc = p.ville && p.ville.trim() ? `à ${p.ville.trim()}` : "dans le coin";
  const intro = copy.intro(loc);
  const bk = p.bookingPlatform;

  if (bk) {
    // Variante "déjà sur une plateforme de réservation"
    return {
      withLink:
        `Salut 👋 ${intro}, ${copy.hook} ! J'ai vu que tu passais par ${bk} — ` +
        `c'est bien pour la résa mais tu paies une commission sur chaque client. ` +
        `Je t'ai préparé un aperçu de ton propre site avec ${copy.value}, sans commission et pour moins cher que ton abo ${bk} : ` +
        `${demoLink}\nDis-moi ce que t'en penses ! — Nicolas, NMF`,
      tease:
        `Salut 👋 ${intro}, ${copy.hook} ! J'ai vu que tu utilisais ${bk} — ` +
        `c'est pratique mais entre l'abo et les commissions ça chiffre vite. ` +
        `Je t'ai préparé un aperçu gratuit de ton propre site avec ${copy.value}, même efficacité mais bien moins cher. ` +
        `Je te l'envoie ? 🙂`,
    };
  }

  return {
    withLink:
      `Salut 👋 ${intro}, ${copy.hook} ! J'ai vu que t'avais pas de site — ` +
      `du coup je t'ai préparé un aperçu gratuit avec ${copy.value} (rien à payer, juste pour voir) : ` +
      `${demoLink}\nDis-moi ce que t'en penses ! — Nicolas, NMF`,
    tease:
      `Salut 👋 ${intro}, ${copy.hook} ! J'ai remarqué que t'avais pas de site, ` +
      `alors je t'ai préparé un aperçu gratuit pour te montrer ce que ça pourrait donner avec ${copy.value}. ` +
      `Je te l'envoie ? 🙂`,
  };
}

/* ────────────────────────────────────────────────────────────
 * Activité récente — « double check » automatisé.
 * Règle métier (méthode prospection) : un profil inactif depuis
 * plus de 3 mois est écarté (profil dormant → taux de réponse nul).
 * ──────────────────────────────────────────────────────────── */

/** Date du dernier post, extraite du `raw` de l'actor Apify (latestPosts[].timestamp). */
export function extractLastPostAt(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const posts = (raw as { latestPosts?: unknown }).latestPosts;
  if (!Array.isArray(posts) || !posts.length) return null;
  let best: number | null = null;
  for (const p of posts) {
    const ts = (p as { timestamp?: unknown })?.timestamp;
    if (typeof ts !== "string") continue;
    const ms = Date.parse(ts);
    if (!Number.isNaN(ms) && (best === null || ms > best)) best = ms;
  }
  return best === null ? null : new Date(best).toISOString();
}

/** Vrai si le dernier post date de moins de `months` mois (défaut 3 — règle du double check). */
export function isActiveSince(lastPostAt: string | null | undefined, months = 3, now = Date.now()): boolean {
  if (!lastPostAt) return false;
  const ms = Date.parse(lastPostAt);
  if (Number.isNaN(ms)) return false;
  return now - ms <= months * 30.5 * 24 * 3600 * 1000;
}

/* ────────────────────────────────────────────────────────────
 * Score d'opportunité 0–100 + tier (hot/warm/cold).
 * Combine les signaux de la méthode de prospection :
 *  - pas de vrai site        +30  (le cœur du pitch NMF)
 *  - actif < 3 mois          +20  (double check)
 *  - 100–2500 abonnés        +15  (bande avatar : artisan/indé, ni mort ni influenceur)
 *  - contact direct dispo    +15  (email ou tél → multi-canal)
 *  - compte business          +10  (intention pro)
 *  - signaux de besoin (bio)  +10  (devis, dispo, contact…)
 * ──────────────────────────────────────────────────────────── */
export interface ScoreInput {
  has_website?: boolean | null;
  last_post_at?: string | null;
  followers?: number | null;
  email?: string | null;
  phone?: string | null;
  is_business?: boolean | null;
  bio?: string | null;
}

const NEED_SIGNALS_RE = /(devis|disponib|dispo\b|contactez|contacte[- ]?moi|sur rdv|sur rendez|dm\b|mp\b|renseignement|estimation gratuite|intervention)/i;

export function prospectScore(p: ScoreInput, now = Date.now()): { score: number; tier: "hot" | "warm" | "cold" } {
  let score = 0;
  if (p.has_website === false) score += 30;
  if (isActiveSince(p.last_post_at, 3, now)) score += 20;
  const f = typeof p.followers === "number" ? p.followers : null;
  if (f !== null && f >= 100 && f <= 2500) score += 15;
  if ((p.email && p.email.trim()) || (p.phone && p.phone.trim())) score += 15;
  if (p.is_business === true) score += 10;
  if (p.bio && NEED_SIGNALS_RE.test(p.bio)) score += 10;
  const tier = score >= 70 ? "hot" : score >= 45 ? "warm" : "cold";
  return { score, tier };
}
