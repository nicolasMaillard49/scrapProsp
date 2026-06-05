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

/** Vrai si le profil est un prospect (pas de vrai site). */
export function isProspect(profile: IgProfile): boolean {
  return !hasRealWebsite(profile.externalUrl);
}

/* ────────────────────────────────────────────────────────────
 * Déduction de la niche (metier) — depuis catégorie business + bio.
 * Renvoie un code aligné sur les kits de template (nicheKits.ts).
 * ──────────────────────────────────────────────────────────── */
type Niche = "coiffeur" | "restaurant" | "estheticienne" | "fleuriste" | "tatoueur" | "";

const NICHE_RULES: { niche: Exclude<Niche, "">; re: RegExp }[] = [
  { niche: "coiffeur", re: /(coiff|barbi|barber|\bhair\b|hairdress|hairstyl|coloris|salon de coiff)/i },
  { niche: "restaurant", re: /(restaur|resto|bistrot|brasserie|pizz|burger|traiteur|cuisine|chef|food|caf[eé]|coffee|sushi|tacos|kebab|cr[eê]perie)/i },
  { niche: "estheticienne", re: /(esth[eé]|institut|beaut|beauty|cosmetic|ongl|nail|spa|maquill|makeup|[eé]pil|cils|lash|sourcil|massage|bien-?[eê]tre)/i },
  { niche: "fleuriste", re: /(fleurist|fleurs|floral|florist|bouquet)/i },
  { niche: "tatoueur", re: /(tatou|tattoo|\bink\b|piercing)/i },
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
  "": { intro: (l) => `Je suis tombé sur ton compte ${l}`, hook: "j'ai bien aimé ce que tu fais", value: "une vraie présence en ligne" },
};

export interface IgDmInput {
  metier: string;
  ville: string;
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
