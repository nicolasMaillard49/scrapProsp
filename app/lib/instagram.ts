// Logique de qualification + personnalisation des prospects Instagram.
// Fonctions PURES (réutilisables côté serveur ET client). Pas d'import serveur ici.

import type { IgProfile } from "./igProviders/types";

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
  | "electricien" | "chauffagiste"
  // Professions libérales (santé, juridique, chiffre) — ajoutées le 02/08/2026.
  | "medecin" | "dentiste" | "kine" | "osteopathe" | "podologue" | "orthophoniste"
  | "psychologue" | "sagefemme" | "veterinaire" | "dieteticien" | "sophrologue"
  | "avocat" | "notaire" | "expertcomptable" | "";

const NICHE_RULES: { niche: Exclude<Niche, "">; re: RegExp }[] = [
  // Artisans du bâtiment EN PREMIER (cible NMF) — leurs bios contiennent souvent
  // des mots « beauté / embellir / spa (de nage) » qui matchaient à tort l'esthétique.
  { niche: "menuisier", re: /(menuis|[eé]b[eé]nist|agencement|mobilier sur[- ]?mesure|travail du bois)/i },
  { niche: "paysagiste", re: /(paysag|jardinier|garden|am[eé]nagement (ext[eé]rieur|paysager)|espaces? verts?|[eé]lagage|cr[eé]ation de jardins?)/i },
  { niche: "carreleur", re: /(carrel|fa[iï]ence|mosa[iï]que)/i },
  { niche: "couvreur", re: /(couvreur|couverture|toiture|zingu|ardoise|tuile)/i },
  { niche: "charpentier", re: /(charpent|ossature bois)/i },
  { niche: "ferronnier", re: /(ferronn|m[eé]tallerie|m[eé]tallier|serrur|garde[- ]?corps|portail)/i },
  { niche: "plaquiste", re: /(plaquiste|pl[aâ]trier|placo|pl[aâ]trerie|cloison)/i },
  { niche: "cuisiniste", re: /(cuisiniste|cuisines? sur[- ]?mesure|am[eé]nagement de cuisine)/i },
  { niche: "plombier", re: /(plombier|plomberie|sanitaire|salle de bain)/i },
  { niche: "electricien", re: /([eé]lectricien|[eé]lectricit[eé]|domotique)/i },
  { niche: "chauffagiste", re: /(chauffag|pompe [aà] chaleur|\bpac\b|climatisation|clim\b)/i },
  { niche: "macon", re: /(ma[cç]on|gros [oœ]uvre|pierre de taille|terrassement)/i },
  { niche: "peintre", re: /(peintre|peinture (int[eé]rieure|ext[eé]rieure|d[eé]co))/i },
  // Professions LIBÉRALES.
  //
  // Placement volontaire : APRÈS le bâtiment (cible historique, prioritaire) et
  // AVANT « estheticienne », dont la regex capture « massage » et « spa » — un
  // kiné ou un ostéo y tomberait sinon. `avocat`, lui, est placé plus bas :
  // le mot désigne aussi un fruit, et un restaurant qui l'affiche au menu doit
  // rester un restaurant.
  //
  // ⚠️ Publicité et démarchage sont DÉONTOLOGIQUEMENT ENCADRÉS pour ces
  // professions (Code de la santé publique pour les soignants, RIN pour les
  // avocats) : la promesse commerciale doit rester factuelle — informer, pas
  // promettre des patients. Voir NICHE_COPY plus bas.
  // « rééducation » appartient AUSSI à l'orthophonie : on teste donc le métier
  // le plus spécifique d'abord, sinon un orthophoniste tombe en kiné.
  { niche: "orthophoniste", re: /(orthophonist|orthophonie|orthoptist)/i },
  { niche: "kine", re: /(kin[eé]sith[eé]rapeut|masseur[- ]?kin|\bkin[eé]\b|r[eé][eé]ducation)/i },
  { niche: "osteopathe", re: /(ost[eé]opath|\bost[eé]o\b)/i },
  { niche: "podologue", re: /(podologue|p[eé]dicure[- ]?podolog|posturolog)/i },
  { niche: "sagefemme", re: /(sage[- ]?femme|ma[iï]eutic|p[eé]rinatalit)/i },
  { niche: "dentiste", re: /(dentiste|chirurgien[- ]?dentiste|orthodontist|cabinet dentaire|implantolog)/i },
  { niche: "veterinaire", re: /(v[eé]t[eé]rinaire|clinique v[eé]t|\bv[eé]to\b)/i },
  { niche: "psychologue", re: /(psychologue|psychoth[eé]rapeut|psychopraticien|neuropsycholog|\bpsy\b)/i },
  { niche: "dieteticien", re: /(di[eé]t[eé]ticien|nutritionniste|micronutrition|di[eé]t[eé]tique)/i },
  { niche: "sophrologue", re: /(sophrolog|hypnoth[eé]rapeut|naturopath)/i },
  // « médecine esthétique » relève de l'esthétique haut ticket, pas du cabinet
  // médical : on exige un marqueur de médecine générale plutôt que le mot seul.
  { niche: "medecin", re: /(m[eé]decin g[eé]n[eé]raliste|cabinet m[eé]dical|docteur en m[eé]decine|\bg[eé]n[eé]raliste\b|maison de sant[eé])/i },
  // Autres niches locales
  { niche: "coiffeur", re: /(coiff|barbi|barber|\bhair\b|hairdress|hairstyl|coloris|salon de coiff)/i },
  { niche: "restaurant", re: /(restaur|resto|bistrot|brasserie|pizz|burger|traiteur|cuisine|chef|food|caf[eé]|coffee|sushi|tacos|kebab|cr[eê]perie)/i },
  // Juridique et chiffre — après « restaurant » : « avocat » est aussi un fruit,
  // et un menu qui l'affiche ne doit pas basculer en cabinet d'avocats.
  { niche: "avocat", re: /(avocat[e]?s? (au barreau|associ|sp[eé]cialis)|barreau de|cabinet d'?avocat|\bavocat fiscalist|droit du travail|droit de la famille)/i },
  { niche: "notaire", re: /(notaire|notarial|\b[eé]tude notariale)/i },
  { niche: "expertcomptable", re: /(expert[- ]?comptable|cabinet comptable|comptabilit[eé]|commissaire aux comptes)/i },
  // « bien-être » retiré (16/07) : trop générique — n'importe quel commerce l'emploie
  // (« votre bien-être et votre satisfaction » sur un poseur de fenêtres → esthéticienne).
  { niche: "estheticienne", re: /(esth[eé]t|institut de beaut|beauty|cosm[eé]t|ongl|nail|maquill|makeup|[eé]pilation|\bcils\b|lash|sourcil|microblading|dermopigment|cryolip|\bhifu\b|microneedling|massage|\bspa\b)/i },
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

/**
 * Accroche DM « angle Ads », construite depuis le rapport concurrentiel :
 * classement Google du prospect + nombre de concurrents qui font des ads.
 * Vouvoiement systématique (décidé le 2026-07-17).
 * Règle de la trame : pure observation + question de curiosité — AUCUNE
 * mention de l'offre (elle n'arrive qu'à la proposition d'appel, M8).
 */
export function competitorHook(input: {
  metier: string;
  ville: string;
  selfRank: number | null;
  adsCount: number;
  firstName?: string | null;
}): string {
  const { metier, ville, selfRank, adsCount } = input;
  const hello = `Hello${input.firstName ? ` ${input.firstName}` : ""}`;
  const requete = `« ${metier} ${ville} »`;
  // Artisans = business téléphone-first ; métiers à RDV (beauté, resto…) = réservations.
  const RDV_METIERS = new Set<string>([
    "estheticienne", "coiffeur", "tatoueur", "restaurant",
    // Les libérales vivent d'un agenda, pas d'appels d'urgence.
    "medecin", "dentiste", "kine", "osteopathe", "podologue", "orthophoniste",
    "psychologue", "sagefemme", "veterinaire", "dieteticien", "sophrologue",
    "avocat", "notaire", "expertcomptable",
  ]);
  const cible = RDV_METIERS.has(detectMetier(metier, null)) ? "ces réservations" : "ces appels";
  const place = selfRank === null ? "vous n'apparaissez pas dans les résultats" : `vous êtes #${selfRank}`;
  const concurrence =
    adsCount > 0
      ? `${adsCount} concurrent${adsCount > 1 ? "s" : ""} paie${adsCount > 1 ? "nt" : ""} déjà pour capter ${cible}`
      : "personne ne paie pour ces recherches en ce moment";
  return `${hello} ! Par curiosité j'ai tapé ${requete} sur Google : ${place}, et ${concurrence}. Vous l'aviez remarqué ?`;
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
  // Libérales — promesse volontairement FACTUELLE : on parle d'informations
  // pratiques et de prise de RDV, jamais d'« attirer des patients ». La
  // publicité comparative ou racoleuse leur est déontologiquement interdite.
  kine: { intro: (l) => `En cherchant des kinés ${l}, je suis tombé sur votre compte`, hook: "votre approche est bien expliquée", value: "un site clair avec vos horaires et la prise de RDV" },
  osteopathe: { intro: (l) => `En cherchant des ostéopathes ${l}, je suis tombé sur votre compte`, hook: "vos explications sont très pédagogiques", value: "un site clair avec vos horaires et la prise de RDV" },
  podologue: { intro: (l) => `En cherchant des podologues ${l}, je suis tombé sur votre compte`, hook: "votre travail est bien présenté", value: "un site clair avec vos horaires et la prise de RDV" },
  orthophoniste: { intro: (l) => `En cherchant des orthophonistes ${l}, je suis tombé sur votre compte`, hook: "votre approche est bien expliquée", value: "un site clair avec vos informations pratiques" },
  sagefemme: { intro: (l) => `En cherchant des sages-femmes ${l}, je suis tombé sur votre compte`, hook: "votre accompagnement inspire confiance", value: "un site clair avec vos informations pratiques et la prise de RDV" },
  dentiste: { intro: (l) => `En cherchant des dentistes ${l}, je suis tombé sur votre cabinet`, hook: "votre cabinet est bien présenté", value: "un site clair avec vos horaires et vos informations pratiques" },
  medecin: { intro: (l) => `En cherchant des médecins ${l}, je suis tombé sur votre cabinet`, hook: "vos informations sont bien tenues à jour", value: "un site clair avec vos horaires et vos informations pratiques" },
  veterinaire: { intro: (l) => `En cherchant des vétérinaires ${l}, je suis tombé sur votre clinique`, hook: "votre équipe donne confiance", value: "un site clair avec vos horaires, urgences et prise de RDV" },
  psychologue: { intro: (l) => `En cherchant des psychologues ${l}, je suis tombé sur votre compte`, hook: "votre approche est très bien expliquée", value: "un site clair avec votre approche et la prise de RDV" },
  dieteticien: { intro: (l) => `En cherchant des diététiciens ${l}, je suis tombé sur votre compte`, hook: "vos conseils sont concrets", value: "un site clair avec votre accompagnement et la prise de RDV" },
  sophrologue: { intro: (l) => `En cherchant des sophrologues ${l}, je suis tombé sur votre compte`, hook: "votre univers est apaisant", value: "un site clair avec vos séances et la prise de RDV" },
  avocat: { intro: (l) => `En cherchant des avocats ${l}, je suis tombé sur votre cabinet`, hook: "vos domaines d'intervention sont clairs", value: "un site qui présente vos domaines et facilite la prise de contact" },
  notaire: { intro: (l) => `En cherchant des notaires ${l}, je suis tombé sur votre étude`, hook: "votre étude est bien présentée", value: "un site qui présente vos services et facilite la prise de contact" },
  expertcomptable: { intro: (l) => `En cherchant des experts-comptables ${l}, je suis tombé sur votre cabinet`, hook: "votre offre est bien expliquée", value: "un site qui présente vos services et facilite la prise de contact" },
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

/**
 * Prénoms admis pour l'accroche — liste blanche, et non plus liste noire d'enseignes.
 *
 * La blacklist perdait la course : chaque scrape ramenait de nouveaux faux prénoms
 * (« Hello Millionaire ! », « Hello Boiseries ! », « Hello Woodery ! »). Un nom de
 * marque est imprévisible, un prénom ne l'est pas — on inverse donc le test. Un
 * prénom absent d'ici retombe sur « Hello » seul, qui n'est jamais faux.
 */
const PRENOMS = new Set([
  // Femmes
  "marie", "nathalie", "isabelle", "sylvie", "catherine", "françoise", "francoise",
  "martine", "christine", "monique", "sandrine", "stephanie", "stéphanie", "veronique",
  "véronique", "valerie", "valérie", "julie", "aurelie", "aurélie", "celine", "céline",
  "sophie", "laurence", "corinne", "patricia", "chantal", "brigitte", "dominique",
  "helene", "hélène", "anne", "claire", "camille", "laura", "manon", "chloe", "chloé",
  "emma", "sarah", "lea", "léa", "clara", "julia", "elodie", "élodie", "amandine",
  "pauline", "charlotte", "marion", "audrey", "emilie", "émilie", "caroline", "delphine",
  "virginie", "karine", "severine", "séverine", "myriam", "nadia", "samia", "fatima",
  "leila", "leïla", "yasmine", "ines", "inès", "lina", "assmae", "anastasia", "melanie",
  "mélanie", "justine", "morgane", "oceane", "océane", "alicia", "jessica", "cindy",
  "vanessa", "laetitia", "lætitia", "angelique", "angélique", "estelle", "florence",
  "beatrice", "béatrice", "agnes", "agnès", "cecile", "cécile", "sabrina", "elise",
  "élise", "adeline", "coralie", "maud", "solene", "solène", "gaelle", "gaëlle",
  "lucie", "eva", "louise", "alice", "jade", "lola", "romane", "margaux", "noemie",
  "noémie", "clemence", "clémence", "axelle", "fanny", "marina", "sonia", "rachel",
  "nina", "kelly", "melissa", "mélissa", "priscilla", "tatiana", "olivia", "ludivine",
  // Hommes
  "jean", "pierre", "michel", "philippe", "alain", "patrick", "christophe", "nicolas",
  "laurent", "eric", "éric", "pascal", "david", "frederic", "frédéric", "stephane",
  "stéphane", "olivier", "thierry", "sebastien", "sébastien", "julien", "vincent",
  "franck", "francois", "françois", "bernard", "daniel", "jacques", "claude", "gerard",
  "gérard", "andre", "andré", "marc", "guillaume", "thomas", "alexandre", "maxime",
  "antoine", "romain", "florian", "kevin", "kévin", "anthony", "jonathan", "jeremy",
  "jérémy", "damien", "cedric", "cédric", "gregory", "grégory", "mathieu", "matthieu",
  "benjamin", "clement", "clément", "quentin", "adrien", "baptiste", "hugo", "lucas",
  "theo", "théo", "enzo", "nathan", "raphael", "raphaël", "gabriel", "arthur", "louis",
  "paul", "victor", "jules", "leo", "léo", "noah", "ethan", "axel", "corentin", "dylan",
  "yann", "yannick", "loic", "loïc", "ludovic", "sylvain", "fabrice", "fabien", "denis",
  "didier", "gilles", "herve", "hervé", "bruno", "serge", "yves", "rene", "rené",
  "roger", "robert", "henri", "georges", "joseph", "charles", "emmanuel", "xavier",
  "arnaud", "aurelien", "aurélien", "bastien", "valentin", "tristan", "simon", "martin",
  "mickael", "mickaël", "michael", "steve", "tony", "jerome", "jérôme", "gaetan",
  "gaëtan", "thibaud", "thibault", "thibaut", "edouard", "édouard", "come", "côme",
  "karim", "mehdi", "rachid", "samir", "yacine", "amine", "youssef", "hakim", "farid",
  "mohamed", "ali", "omar", "bilal", "sofiane", "ryan", "jordan", "alan", "alex",
  "matteo", "mattéo", "mateo", "elias", "adam", "isaac", "eliott", "eliot", "milan",
  "samuel", "raphael", "jeremie", "jérémie", "benoit", "benoît", "cyril", "regis",
  "régis", "dimitri", "jerome", "gautier", "gauthier", "lionel", "pascal", "roland",
  "christian", "guy", "alexis", "theophile", "théophile", "aymeric", "amaury", "hadrien",
  "gaspard", "ambroise", "constant", "leon", "léon", "marius", "sacha", "noe", "noé",
  "timothe", "timothée", "timothee", "augustin", "felix", "félix", "oscar", "achille",
]);

/**
 * Prénom exploitable depuis un `full_name`, ou `null` si rien de fiable.
 *
 * Le 1er mot d'un `full_name` n'est un prénom que rarement : sans filtre l'accroche
 * sortait « Hello Bois ! » (Bois et jardins), « Hello CP ! », « Hello GARDE ! ».
 * On préfère `null` au moindre doute — l'accroche retombe alors sur « Hello » seul,
 * qui n'est jamais faux. Conséquence assumée : quelques vrais prénoms sont perdus
 * (« Marié Stéphane | Couvreur » → null à cause du séparateur, un prénom rare
 * absent de `PRENOMS`).
 */
export function firstNameOf(fullName?: string | null): string | null {
  const nom = (fullName ?? "").trim();
  if (!nom) return null;
  // Séparateurs et symboles = mise en forme d'enseigne, pas un état civil.
  if (/[|&/•·@_\d]/.test(nom)) return null;
  const mots = nom.split(/\s+/);
  if (mots.length > 3) return null;
  // « GARDE IMPERIAL BARBERSHOP » : capitales sur plusieurs mots = marque.
  if (mots.length > 1 && nom === nom.toUpperCase()) return null;

  const premier = mots[0];
  if (!/^\p{L}+$/u.test(premier)) return null;
  if (premier.length < 3 || premier.length > 15) return null;

  // Liste blanche : « Thibaud » passe, « Boiseries » / « Millionaire » non.
  // On teste aussi la forme sans accent — « Frédéric » saisi « Frederic » et
  // inversement doivent tomber sur la même entrée.
  const bas = premier.toLowerCase();
  const sansAccent = bas.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (!PRENOMS.has(bas) && !PRENOMS.has(sansAccent)) return null;

  // « ADELINE » → « Adeline », « stéphane » → « Stéphane ».
  return premier[0].toUpperCase() + premier.slice(1).toLowerCase();
}

/* ────────────────────────────────────────────────────────────
 * Hors-cible : ce qui ne doit jamais entrer dans une file d'envoi.
 * Constaté le 20/07/2026 — sur 45 prospects tirés, ~13 étaient
 * injoignables ou inutiles : comptes hors zone francophone (Porto Rico,
 * Indonésie, Floride, Québec, Roumanie, Maroc), fournisseurs B2B
 * (machines, logiciels pour menuisiers), blogs perso et chaînes.
 * Un DM en français leur coûte du quota pour zéro réponse possible.
 * ──────────────────────────────────────────────────────────── */

/** Marqueurs de langue non francophone dans une bio. */
const LANGUE_ETRANGERE = [
  // Allemand
  /\bab \d+j\b/i, /\bAGB'?s?\b/i, /\bTermine\b/, /\bdeine?\b/i,
  // Espagnol
  /\bcertificad[ao]\b/i, /\ba[nñ]os\b/i, /\bcitas?\b/i, /\bpesta[nñ]as\b/i,
  // Roumain
  /\bmeseria\b/i, /\btatuator\b/i,
  // Indonésien / malais
  /\bjalan\b/i, /\btelp\b/i, /\bharga\b/i, /\bpemesanan\b/i,
];

/** Localisations hors zone francophone (FR/BE/CH/LU). */
const HORS_ZONE = [
  /\b(PR|FL|CA|TX|NY|QC)\b/, /\bPuerto Rico\b/i, /\bQu[ée]bec\b/i, /\bMaroc\b/i,
  /\bMorocco\b/i, /\bTunisie\b/i, /\bAlg[ée]rie\b/i, /\bFlorida\b/i, /\bWinter (Garden|Park)\b/i,
];

/** Activités qui ne sont pas notre cible (on vise l'artisan / commerce de proximité). */
const NON_CIBLE = [
  /vente des machines/i, /machines pour l'usinage/i, /\ble logiciel des\b/i,
  /\blogiciel\b.*\b(menuisier|artisan)/i, /\d+\s+(jardineries|magasins|boutiques)\b/i,
];

/** Catégories Instagram qui trahissent un compte non commercial. */
const CATEGORIE_NON_CIBLE = new Set(["personal blog", "digital creator", "blogger"]);

/**
 * `true` si le prospect ne doit pas recevoir de DM : hors zone francophone,
 * hors cible, ou compte non commercial. Volontairement conservateur — mieux
 * vaut écarter un prospect douteux que brûler du quota sur un compte injoignable.
 */
export function isHorsCible(p: {
  bio?: string | null;
  full_name?: string | null;
  category?: string | null;
}): boolean {
  const texte = `${p.full_name ?? ""} ${p.bio ?? ""}`;
  if (!texte.trim()) return false; // Bio vide : on laisse passer, l'accroche générique reste vraie.

  const cat = (p.category ?? "").trim().toLowerCase();
  if (CATEGORIE_NON_CIBLE.has(cat)) return true;

  return [...LANGUE_ETRANGERE, ...HORS_ZONE, ...NON_CIBLE].some((re) => re.test(texte));
}

export interface IgDmInput {
  metier: string;
  ville: string;
  bookingPlatform?: string | null;
  /** Prénom du prospect — utiliser `firstNameOf()`, jamais le 1er mot brut du full_name. */
  firstName?: string | null;
  /** Profession détectée par l'IA de qualification — prioritaire sur `metier` pour l'accroche. */
  professionIa?: string | null;
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
 * Séquence DM « trame de prospection » (méthode organique) :
 * accroche → présentation en 3 messages → connexion → focus → douleur →
 * proposition d'appel → questionnaire.
 * Règles de forme respectées : messages courts et découpés, question à
 * chaque fin, AUCUNE ressource envoyée en DM — pas d'aperçu de site, pas
 * d'exemple, pas de lien démo : le seul lien de la trame est le
 * questionnaire de M9, une fois le « oui » obtenu.
 * ──────────────────────────────────────────────────────────── */

/** Lien du questionnaire pré-appel (formulaire de diagnostic NMF). */
export const QUESTIONNAIRE_URL = "https://bienvenue.nmf-agence.com";

const BATIMENT = new Set([
  "menuisier", "paysagiste", "carreleur", "peintre", "macon", "couvreur",
  "charpentier", "ferronnier", "plaquiste", "cuisiniste", "plombier",
  "electricien", "chauffagiste",
]);

/** Nom de métier naturel pour l'accroche « j'ai vu que tu étais X, c'est toujours le cas ? ». */
/** Métiers formulés « vous teniez un … » (établissement) plutôt que « vous étiez … ». */
const METIER_LIEU: Record<string, string> = {
  restaurant: "un restaurant",
  coiffeur: "un salon de coiffure",
};

const METIER_NOUN: Record<string, string> = {
  menuisier: "menuisier",
  paysagiste: "paysagiste",
  carreleur: "carreleur",
  peintre: "peintre",
  macon: "maçon",
  couvreur: "couvreur",
  charpentier: "charpentier",
  ferronnier: "ferronnier",
  plaquiste: "plaquiste",
  cuisiniste: "cuisiniste",
  plombier: "plombier",
  electricien: "électricien",
  chauffagiste: "chauffagiste",
  coiffeur: "coiffeur",
  estheticienne: "esthéticienne",
  fleuriste: "fleuriste",
  tatoueur: "tatoueur(se)",
  photographe: "photographe",
  boulanger: "boulanger",
};

/** Vocabulaire « douleur » selon la niche (demandes / stabilité). */
/** Professions libérales : agenda plutôt que devis, et communication encadrée. */
const LIBERALES = new Set<string>([
  "medecin", "dentiste", "kine", "osteopathe", "podologue", "orthophoniste",
  "psychologue", "sagefemme", "veterinaire", "dieteticien", "sophrologue",
  "avocat", "notaire", "expertcomptable",
]);

function painWording(metier: string): { demandes: string; stable: string } {
  if (BATIMENT.has(metier)) {
    return { demandes: "des demandes de devis régulières", stable: "un planning rempli plusieurs semaines à l'avance" };
  }
  if (metier === "restaurant") {
    return { demandes: "des réservations régulières", stable: "une salle bien remplie toute la semaine" };
  }
  if (metier === "coiffeur" || metier === "estheticienne" || metier === "tatoueur") {
    return { demandes: "des demandes de RDV régulières", stable: "un agenda bien rempli" };
  }
  if (LIBERALES.has(metier)) {
    return { demandes: "de nouvelles demandes régulières", stable: "un agenda bien rempli" };
  }
  return { demandes: "des demandes régulières", stable: "une activité stable" };
}

export interface IgDmStep {
  step: string; // "M1", "M2"… "R1"…
  title: string;
  text: string;
}

/**
 * Construit la séquence complète de messages (9 étapes + 3 relances),
 * à copier une par une selon les réponses du prospect.
 * `demoLink` (aperçu /di/<code>) n'est PLUS utilisé dans la trame : on
 * n'envoie aucune ressource en DM, l'aperçu se montre à l'appel. Le
 * paramètre est conservé pour ne pas casser les appelants.
 * Vouvoiement systématique (décidé le 2026-07-17) : la trame « solo » au
 * tutoiement est supprimée, on ne s'adresse plus qu'en « vous ».
 */
/**
 * Trame DM. RACCOURCIE le 02/08/2026 : les messages faisaient 3-4 lignes de
 * justification (« certains détails précis m'ont mis la puce à l'oreille »,
 * « quelques pistes de réflexion sur ces éléments ») — une longueur et une
 * syntaxe qui se lisent immédiatement comme du texte généré, surtout en DM
 * Instagram où l'on écrit court. Chaque étape tient désormais en une ou deux
 * phrases parlées. Les règles de fond ne bougent pas : vouvoiement, aucune
 * ressource avant M9, aucun pitch avant M8.
 */
/**
 * Valeurs de `profession_ia` qui ne désignent AUCUNE profession.
 *
 * La qualification IA rend parfois « inconnu », « indéterminé », « particulier ».
 * Injectées telles quelles, elles produisent « J'ai vu que vous étiez inconnu,
 * c'est toujours le cas ? » — dans un vrai DM, à un vrai prospect.
 */
const PROFESSION_VIDE = /^(inconnu|inconnue|ind[eé]termin[eé]e?|non renseign[eé]e?|non d[eé]fini|autre|particulier|particuliers|n\/?a|aucun|aucune|\?+)$/i;

/**
 * Valeurs qui désignent un ÉTABLISSEMENT, pas un métier.
 *
 * « Vous étiez restaurant » ne se dit pas : un lieu se TIENT. Plutôt que
 * d'inventer un article et un genre (« un » menuiserie ?), on écarte la
 * profession IA et on laisse la cascade reprendre la main — elle sait dire
 * « vous teniez un restaurant », ou retomber sur l'accroche générique.
 */
const PROFESSION_LIEU = /^(restaurant|menuiserie|boulangerie|boucherie|p[aâ]tisserie|pharmacie|garage|clinique|magasin|boutique|[eé]picerie|brasserie|pizzeria|bar|h[oô]tel|camping|spa)\b|^(cabinet|salon|institut|agence|entreprise|soci[eé]t[eé]|studio|atelier|organisme|centre|[eé]cole|association|groupe|maison)\b/i;

/** Nom du métier tel qu'on l'écrit dans une phrase (« vous étiez <noun> »). */
function nounOf(p: IgDmInput): string | null {
  const ia = (p.professionIa ?? "").trim().toLowerCase();
  // La profession IA (précise) prime sur le métier détecté par regex — SAUF
  // quand elle ne nomme pas une profession. Relevé le 04/08/2026 sur la base :
  // « restaurant » (52), « inconnu » (25), « indéterminé » (21), « menuiserie »
  // (18), « cabinet dentaire » (17) partaient tels quels dans l'accroche.
  return (professionIaUtilisable(ia) ? ia : "") || METIER_NOUN[p.metier] || null;
}

/**
 * Vrai si la profession IA peut se dire dans une phrase.
 *
 * Trois refus, tous constatés sur la base le 04/08/2026 :
 *  - les non-professions (« inconnu », « particulier ») ;
 *  - les établissements (« restaurant », « cabinet dentaire ») ;
 *  - les LIBELLÉS DE TAXONOMIE, reconnaissables à leur barre oblique
 *    (« Agenceur/Marque », « SaaS/Logiciel ») ou à leur longueur. Personne ne
 *    dit « vous êtes saas/logiciel » — c'est une case de classement, pas un
 *    métier, et ça se voit immédiatement dans un DM.
 */
export function professionIaUtilisable(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v || v.length > 30 || v.includes("/")) return false;
  return !PROFESSION_VIDE.test(v) && !PROFESSION_LIEU.test(v);
}

/**
 * Premier message — commun aux deux trames.
 *
 * Il n'y a aucune raison de le faire varier d'une trame à l'autre : c'est le
 * seul message dont on a mesuré le taux de réponse, et ce qui change entre
 * « standard » et « site » commence AU DEUXIÈME message.
 */
function accrocheOf(p: IgDmInput): string {
  const hello = p.firstName && p.firstName.trim() ? `Hello ${p.firstName.trim()}` : "Hello";
  const noun = nounOf(p);
  // Un établissement se « tient », un métier se « est » : « vous étiez coiffeur(se) »
  // sonnait comme un formulaire — un salon ou un resto se formule au lieu.
  // « un salon de coiffure » l'emporte dès que la profession IA est écartée :
  // sinon un restaurant dont profession_ia vaut « restaurant » perdrait la
  // formulation au lieu ET son noun, et tomberait dans l'accroche générique.
  const lieu = professionIaUtilisable(p.professionIa) ? null : METIER_LIEU[p.metier];
  return lieu
    ? `${hello} ! J'ai vu que vous teniez ${lieu}, c'est toujours le cas ?`
    : noun
      ? `${hello} ! J'ai vu que vous étiez ${noun}, c'est toujours le cas ?`
      : `${hello} ! Je suis tombé sur votre compte en scrollant — vous êtes toujours en activité en ce moment ?`;
}

/**
 * Les mots dont une variante d'accroche a besoin pour rester personnalisée.
 *
 * Une variante est un texte fixe en base : sans ces valeurs, elle enverrait le
 * même message à tout le monde et perdrait exactement ce qui fait marcher
 * l'accroche standard (le prénom, le métier réel, la formulation au lieu).
 */
export interface AccrocheVars {
  prenom: string;
  /** « Hello Laura » ou « Hello » — l'ouverture, prénom inclus s'il est sûr. */
  hello: string;
  /** « esthéticienne », « menuisier »… vide si le métier est inconnu. */
  metier: string;
  /** « un salon de coiffure », « un restaurant » — vide hors établissements. */
  lieu: string;
  ville: string;
}

export function accrocheVars(p: IgDmInput): AccrocheVars {
  const prenom = p.firstName && p.firstName.trim() ? p.firstName.trim() : "";
  return {
    prenom,
    hello: prenom ? `Hello ${prenom}` : "Hello",
    metier: nounOf(p) ?? "",
    lieu: (professionIaUtilisable(p.professionIa) ? null : METIER_LIEU[p.metier]) ?? "",
    ville: (p.ville ?? "").trim(),
  };
}

/**
 * Relances R1-R3 — communes aux deux trames.
 * Elles ne parlent jamais du contenu de la séquence : elles relancent le
 * silence, pas l'étape. Rien à dupliquer d'une trame à l'autre.
 */
function relancesOf(p: IgDmInput): IgDmStep[] {
  const prenom = p.firstName ? p.firstName.trim() : "";
  return [
    {
      step: "R1",
      title: "Relance — 1 h après un vu (jamais entre 20 h et 8 h)",
      text: `Vous avez eu le temps de checker mon message${prenom ? ` ${prenom}` : ""} ?`,
    },
    {
      step: "R2",
      title: "Relance — nouveau vu (attendre 6-8 h)",
      text: `Toujours avec moi${prenom ? ` ${prenom}` : ""} ?`,
    },
    {
      step: "R3",
      title: "Relance — nouveau vu (5-8 h) ; ensuite image humour puis mème perso",
      text: `${prenom || "Alors"} ?? 😄`,
    },
  ];
}

export function instagramDmSequence(p: IgDmInput, demoLink: string): IgDmStep[] {
  const avatar = BATIMENT.has(p.metier)
    ? "les artisans du bâtiment"
    : "les indépendants et commerces de proximité";
  const pain = painWording(p.metier);
  const bk = p.bookingPlatform;
  const accroche = accrocheOf(p);

  return [
    {
      step: "M1",
      title: "Accroche (à varier d'un prospect à l'autre)",
      text: accroche,
    },
    {
      step: "M2",
      title: "Présentation 1/3 — contexte (après son oui)",
      text: `Parfait ! Votre post est remonté dans mon feed, j'ai jeté un œil au profil et deux-trois trucs m'ont interpellé.`,
    },
    {
      step: "M3",
      title: "Présentation 2/3 — qui je suis",
      text: `Moi c'est Nicolas, 6 ans dans le digital, surtout avec ${avatar}.`,
    },
    {
      step: "M4",
      title: "Présentation 3/3 — la question",
      text: `Ça vous dérange si je vous dis ce que j'ai remarqué ?`,
    },
    {
      step: "M5",
      title: "Connexion",
      text: `Avant ça, vous faites ce métier depuis longtemps ?`,
    },
    {
      step: "M6",
      title: "Focus",
      text: `Et en ce moment vous êtes plutôt sur le terrain, ou à chercher des clients ?`,
    },
    {
      step: "M7",
      title: "Recherche de douleur",
      text:
        `Et ça donne quoi ? Vous avez ${pain.demandes}, ou c'est en dents de scie ?` +
        (bk ? `\n\n(Variante ${bk} : « J'ai vu que vous passiez par ${bk} — ça vous va niveau commissions ? »)` : ""),
    },
    {
      step: "M8",
      title: "Proposition d'appel (aucune ressource, aucun exemple de site)",
      text: `Ok. Le plus simple c'est qu'on se cale 15-20 min et je vous montre ce que j'ai vu. Vous avez un créneau cette semaine ?`,
    },
    {
      step: "M9",
      title: "Questionnaire (après son oui, avant de bloquer le créneau)",
      text:
        `Top ! Avant que je bloque le créneau, un petit questionnaire pour préparer l'appel — 2 min 👉 ${QUESTIONNAIRE_URL}\n\n` +
        `Dites-moi quand c'est fait.`,
    },
    ...relancesOf(p),
  ];
}

/**
 * Requête telle qu'un client la taperait : « esthéticienne Angers ».
 * `null` si on ne sait ni le métier ni la ville — on ne met pas de mots
 * approximatifs dans la bouche du prospect, la question marche sans.
 */
export function searchQueryOf(p: IgDmInput): string | null {
  const noun = nounOf(p);
  const ville = (p.ville ?? "").trim();
  if (!noun && !ville) return null;
  return [noun, ville].filter(Boolean).join(" ");
}

/**
 * Trame SITE (S1…S5) — la variante « il n'a pas de site ».
 *
 * POURQUOI une seconde trame plutôt qu'un réglage de la première : toute
 * l'audience Instagram est sélectionnée sur `has_website === false` (+30 au
 * score d'opportunité), et la trame standard met SEPT messages à arriver sur
 * la douleur — sans jamais nommer celle qu'on est venu résoudre. Ici la
 * question tombe au 2ᵉ message et la maquette au 3ᵉ.
 *
 * La règle « aucune ressource avant M9 » de la trame standard ne s'applique
 * pas ici, et ce n'est pas un oubli : la maquette N'EST PAS une ressource
 * (guide, étude de cas, lien d'agence) — c'est son propre site, portant son
 * nom, qui ne se comprend qu'en le voyant. C'est l'argument, pas un support.
 *
 * Les étapes portent un identifiant distinct (S…) et non M… : c'est ce qui
 * rend les deux trames comparables dans `ig_dm_log` (quelle trame a produit
 * quelle réponse). Un identifiant partagé rendrait la mesure impossible.
 *
 * Correspondance stade ↔ étape : cf. `stageForStep` / `nextStepFor` dans
 * igPipeline. Le stade est une POSITION dans le tunnel, pas un synonyme du
 * contenu du message — les deux trames occupent les mêmes six positions,
 * c'est ce qui garde le kanban et les KPI lisibles.
 */
export function instagramDmSequenceSite(p: IgDmInput, demoLink: string): IgDmStep[] {
  const query = searchQueryOf(p);
  // La question porte d'abord sur SON nom (ce qu'il vérifiera lui-même dans la
  // minute), puis sur la requête générique — dans cet ordre : le premier lui
  // parle de lui, le second lui parle de ses clients perdus.
  const question = query
    ? `Parfait ! Une question toute bête : aujourd'hui, quand quelqu'un cherche votre nom sur Google — ou juste « ${query} » — il tombe sur quoi ?`
    : `Parfait ! Une question toute bête : aujourd'hui, quand quelqu'un cherche votre nom sur Google, il tombe sur quoi ?`;

  return [
    {
      step: "S1",
      title: "Accroche (identique à la trame standard)",
      text: accrocheOf(p),
    },
    {
      step: "S2",
      title: "La question qui ouvre le sujet (après son oui)",
      text: question,
    },
    {
      step: "S3",
      title: "Le retournement + la maquette (le message qui porte la trame)",
      // Le retournement d'abord, la preuve juste après : montrer la maquette
      // avant d'avoir nommé le manque en fait une jolie image ; après, elle
      // devient la réponse à un problème qu'il vient de formuler lui-même.
      // Le lien est sur sa propre ligne pour qu'il puisse partir en deux
      // bulles — un lien seul dans sa bulle s'ouvre bien plus qu'un lien
      // collé en fin de paragraphe.
      text:
        `C'est exactement là que ça coince : on passe son temps à chercher des clients, pendant que ceux qui vous cherchent DÉJÀ ne vous trouvent pas.\n\n` +
        `Du coup je vous ai fait un aperçu de ce que ça pourrait donner, à votre nom — 30 secondes à regarder :\n` +
        (demoLink || "(aperçu indisponible — prospect hors base)"),
    },
    {
      step: "S4",
      title: "Proposition d'appel (après sa réaction à la maquette)",
      text: `Content que ça vous parle ! Le plus simple c'est qu'on se cale 15-20 min, je vous montre ce qu'on peut en faire. Vous avez un créneau cette semaine ?`,
    },
    {
      step: "S5",
      title: "Questionnaire (après son oui, avant de bloquer le créneau)",
      text:
        `Top ! Avant que je bloque le créneau, un petit questionnaire pour préparer l'appel — 2 min 👉 ${QUESTIONNAIRE_URL}\n\n` +
        `Dites-moi quand c'est fait.`,
    },
    ...relancesOf(p),
  ];
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
