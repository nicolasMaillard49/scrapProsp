// Kits de CONTENU par métier du bâtiment — le pendant de nicheKits.ts.
//
// Même principe que les niches : le kit dit ce que le métier vend, ce qu'on
// montre en photo, ce que ses clients en disent, et QUEL MODULE la maquette
// pose dans le hero. La direction artistique, elle, vit dans le composant.
//
// Pourquoi un fichier séparé des niches : un artisan ne vend pas un créneau, il
// vend une intervention et un devis. Les champs qui comptent ne sont donc pas
// les mêmes (durée d'un soin vs délai d'intervention, catalogue de prestations
// vs étapes de chantier), et forcer les deux dans une seule interface aurait
// donné un objet à moitié vide des deux côtés.
//
// Le module (`module`) est un type discriminé : chaque direction artistique lit
// le sien, et le typage empêche de brancher un nuancier sur un plombier.
//
// Images : IDs Unsplash vérifiés (HTTP 200) + fichiers locaux /templates/.

import type { NicheTestimonial, OfferKind } from "./nicheKits";

export interface ArtisanService {
  name: string;
  desc: string;
  /** En euros. 0 = affiché « Offert » (devis, déplacement). */
  price: number;
  /** Prix plancher : affiche « dès 90 € ». */
  from?: boolean;
  /** Unité accolée au prix (« /m² », « /h »). */
  unit?: string;
  cat: string;
}

/* ── Modules signature, un par direction artistique ─────────── */

/** Urgence (plombier, serrurier) : le délai et le prix annoncés AVANT l'appel. */
export interface UrgenceModule {
  kind: "urgence";
  /** Délai d'arrivée affiché en grand. */
  delay: string;
  /** Les pannes qu'on peut décrire en un clic. */
  pannes: Array<{ icon: string; label: string; price: string }>;
  /** Ce qui rassure sur le prix (le sujet n° 1 du dépannage). */
  priceNote: string;
}

/** Conformité (électricien) : le diagnostic du tableau, point par point. */
export interface ConformiteModule {
  kind: "conformite";
  norme: string;
  checks: Array<{ point: string; why: string; ok: boolean }>;
}

/** Thermique (chauffagiste) : économies annuelles et aides de l'État. */
export interface ThermiqueModule {
  kind: "thermique";
  /** Facture annuelle avant / après, en euros. */
  before: number;
  after: number;
  aides: Array<{ name: string; amount: string }>;
  entretienNote: string;
}

/** Chantier (couvreur, maçon) : les étapes, du premier appel à la réception. */
export interface ChantierModule {
  kind: "chantier";
  steps: Array<{ title: string; desc: string; delay: string }>;
  /** Les signes qui doivent faire appeler — l'accroche du métier. */
  alertes: string[];
}

/** Établi (menuisier) : les essences, la matière avant le meuble. */
export interface EtabliModule {
  kind: "etabli";
  essences: Array<{ name: string; color: string; note: string }>;
  delaiNote: string;
}

/** Surface (peintre, carreleur) : le calcul au m² et les finitions. */
export interface SurfaceModule {
  kind: "surface";
  /** Prix moyen au m², pour l'estimateur. */
  pricePerM2: number;
  /** Pièces types proposées en un clic, avec leur surface. */
  pieces: Array<{ label: string; m2: number }>;
  finitions: Array<{ name: string; color: string; note: string }>;
}

/** Jardin (paysagiste) : ce qu'on fait, saison par saison. */
export interface JardinModule {
  kind: "jardin";
  saisons: Array<{ name: string; months: string; tasks: string[] }>;
  contratNote: string;
}

export type ArtisanModule =
  | UrgenceModule
  | ConformiteModule
  | ThermiqueModule
  | ChantierModule
  | EtabliModule
  | SurfaceModule
  | JardinModule;

export interface ArtisanKit {
  accent: string;
  accentDark: string;
  hero: string;
  about: string;
  /** Portrait du professionnel — cf. templates/portrait.tsx. */
  portrait: string;
  gallery: string[];
  services: ArtisanService[];
  testimonials: NicheTestimonial[];
  /** Paragraphe à-propos. Placeholders {ville} / {name}. */
  aboutText: string;
  ticker: string[];
  /** Toujours « vitrine » aujourd'hui : aucune maquette artisan ne montre
   *  d'agenda. Le jour où l'une en montre un, elle passe à « booking » — et le
   *  prix affiché suit tout seul (cf. OfferBlock). */
  offer: OfferKind;
  bookingWord: string;
  /** Le titre du hero, en deux morceaux (le 2e prend l'accent). */
  promise: { lead: string; strong: string; sub: string };
  /** Trois chiffres de réassurance. */
  facts: Array<{ k: string; v: string }>;
  /** Communes couvertes — un artisan se choisit d'abord sur la distance. */
  zone: string[];
  /** Garanties affichées en pied de hero (décennale, agrément…). */
  garanties: string[];
  labels: {
    catalogue: string;
    catalogueSub: string;
    catalogueNote: string;
    gallery: string;
    gallerySub: string;
    cta: string;
    ctaFinal: string;
  };
  module: ArtisanModule;
}

const u = (id: string, w = 1100) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const DEFAULT_LABELS: ArtisanKit["labels"] = {
  catalogue: "Les",
  catalogueSub: "prestations",
  catalogueNote: "Tarifs indicatifs — un devis ferme est établi après visite.",
  gallery: "Les",
  gallerySub: "chantiers",
  cta: "Demander un devis",
  ctaFinal: "appeler",
};

/* ══ URGENCE ═══════════════════════════════════════════════════ */

const PLOMBIER: ArtisanKit = {
  accent: "#1D6FB8",
  accentDark: "#14507F",
  hero: "/templates/plombier-hero.jpg",
  about: u("photo-1676210134188-4c05dd172f89", 1000),
  portrait: "/templates/plombier-portrait.webp",
  gallery: [
    u("photo-1676210133055-eab6ef033ce3", 700),
    u("photo-1676210134190-3f2c0d5cf58d", 700),
    u("photo-1676210134050-6f12c6898395", 700),
    u("photo-1562448079-7557fc7f04e9", 700),
    u("photo-1552321554-5fefe8c9ef14", 700),
    u("photo-1585704032915-c3400ca199e7", 700),
  ],
  services: [
    { name: "Recherche et réparation de fuite", desc: "Détection sans casse, réparation dans la foulée quand c'est accessible.", price: 120, from: true, cat: "Dépannage" },
    { name: "Débouchage canalisation", desc: "Furet ou haute pression selon le bouchon. Évacuation testée avant de partir.", price: 140, from: true, cat: "Dépannage" },
    { name: "Panne de chauffe-eau", desc: "Diagnostic, remplacement de résistance ou de groupe de sécurité.", price: 110, from: true, cat: "Dépannage" },
    { name: "Remplacement de chauffe-eau", desc: "Dépose de l'ancien, pose du neuf, mise en eau et évacuation.", price: 690, from: true, cat: "Installation" },
    { name: "Salle de bain complète", desc: "Douche, meuble, WC et raccordements. Coordination des autres corps de métier.", price: 3200, from: true, cat: "Rénovation" },
    { name: "Déplacement et devis", desc: "Déplacement offert sur devis accepté, devis toujours gratuit.", price: 0, cat: "Devis" },
  ],
  testimonials: [
    { author: "Sandrine L.", rating: 5, comment: "Fuite sous l'évier un dimanche matin, il était là à 11 h. Prix annoncé au téléphone, prix payé.", date: "mars 2024" },
    { author: "Patrick M.", rating: 5, comment: "Chauffe-eau mort la veille de Noël. Remplacé le lendemain matin. Propre, rapide, poli.", date: "février 2024" },
    { author: "Nadia B.", rating: 4, comment: "Salle de bain refaite en dix jours comme annoncé. Un petit retard sur la faïence, rien de grave.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} dépanne depuis des années les fuites qui n'attendent pas et refait les salles de bain qui peuvent attendre. Le prix est annoncé avant de monter, le chantier est laissé propre, et le numéro reste le même après l'intervention.",
  ticker: ["Dépannage 7j/7", "Devis gratuit", "Prix annoncé avant", "Garantie décennale"],
  offer: "vitrine",
  bookingWord: "le planning",
  promise: { lead: "Une fuite", strong: "n'attend pas.", sub: "Décrivez la panne, on annonce le prix et l'heure d'arrivée avant de raccrocher." },
  facts: [
    { k: "45 min", v: "délai moyen d'arrivée en urgence" },
    { k: "7j/7", v: "y compris week-ends et jours fériés" },
    { k: "0 €", v: "de déplacement sur devis accepté" },
  ],
  zone: ["Centre-ville", "Périphérie", "20 km alentour"],
  garanties: ["Garantie décennale", "Artisan assuré", "Facture détaillée"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les",
    catalogueSub: "interventions",
    catalogueNote: "Tarifs de départ TTC, main-d'œuvre comprise. Le devis est gratuit et ferme.",
    gallery: "Le travail",
    gallerySub: "fini",
    cta: "Appeler maintenant",
    ctaFinal: "appeler",
  },
  module: {
    kind: "urgence",
    delay: "45 min",
    pannes: [
      { icon: "💧", label: "Fuite d'eau", price: "dès 120 €" },
      { icon: "🚽", label: "WC bouché", price: "dès 140 €" },
      { icon: "🔥", label: "Chauffe-eau", price: "dès 110 €" },
      { icon: "🚿", label: "Robinetterie", price: "dès 90 €" },
    ],
    priceNote:
      "Le prix est annoncé au téléphone, avant le déplacement. Pas de supplément découvert sur place.",
  },
};

const SERRURIER: ArtisanKit = {
  accent: "#E0622B",
  accentDark: "#B44A1C",
  hero: u("photo-1585914641050-fa9883c4e21c", 1400),
  about: u("photo-1677951570313-b0750351c461", 1000),
  portrait: "/templates/serrurier-portrait.webp",
  gallery: [
    u("photo-1643804926339-e94f0a655185", 700),
    u("photo-1733244766159-f58f4184fd38", 700),
    u("photo-1563845104292-41c1b4825255", 700),
    u("photo-1585914641050-fa9883c4e21c", 700),
  ],
  services: [
    { name: "Ouverture de porte claquée", desc: "Ouverture fine, sans dégât sur la porte ni le cylindre.", price: 90, from: true, cat: "Urgence" },
    { name: "Ouverture après effraction", desc: "Ouverture, sécurisation provisoire et devis de remise en état.", price: 140, from: true, cat: "Urgence" },
    { name: "Changement de cylindre", desc: "Cylindre européen de marque, trois clés fournies.", price: 130, from: true, cat: "Serrure" },
    { name: "Serrure multipoints", desc: "Pose ou remplacement d'une serrure 3 ou 5 points, A2P au choix.", price: 390, from: true, cat: "Serrure" },
    { name: "Blindage de porte", desc: "Renfort de bloc-porte, cornière anti-pince et barre de seuil.", price: 890, from: true, cat: "Sécurité" },
    { name: "Devis et déplacement", desc: "Devis gratuit, déplacement offert si le devis est accepté.", price: 0, cat: "Devis" },
  ],
  testimonials: [
    { author: "Émilie R.", rating: 5, comment: "Porte claquée à 23 h avec le bébé à l'intérieur. Arrivé en 25 minutes, ouverte sans rien casser.", date: "mars 2024" },
    { author: "Hervé T.", rating: 5, comment: "Prix annoncé par téléphone, prix sur la facture. Après ce que j'avais lu sur les arnaques, ça change.", date: "février 2024" },
    { author: "Karim S.", rating: 5, comment: "Après un cambriolage : sécurisation le soir même, porte blindée posée trois jours après.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} ouvre les portes sans les casser et pose des serrures qui tiennent. Le tarif est donné au téléphone, la facture est détaillée, et le devis reste gratuit même si vous ne donnez pas suite.",
  ticker: ["Urgence 24h/24", "Prix annoncé au téléphone", "Ouverture sans dégât", "Serrures A2P"],
  offer: "vitrine",
  bookingWord: "le planning",
  promise: { lead: "Dehors,", strong: "à 23 h.", sub: "Un prix annoncé au téléphone, une ouverture sans dégât, une facture détaillée." },
  facts: [
    { k: "25 min", v: "délai moyen d'arrivée en ville" },
    { k: "24h/24", v: "nuits, week-ends et fériés" },
    { k: "A2P", v: "serrures certifiées, agréées assurance" },
  ],
  zone: ["Centre-ville", "Périphérie", "15 km alentour"],
  garanties: ["Devis gratuit", "Agréé assurances", "Pièces garanties 2 ans"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les",
    catalogueSub: "tarifs",
    catalogueNote: "Tarifs TTC affichés d'avance. Aucun supplément décidé sur place.",
    gallery: "Nos",
    gallerySub: "poses",
    cta: "Appeler maintenant",
    ctaFinal: "appeler",
  },
  module: {
    kind: "urgence",
    delay: "25 min",
    pannes: [
      { icon: "🚪", label: "Porte claquée", price: "dès 90 €" },
      { icon: "🔑", label: "Clé cassée", price: "dès 110 €" },
      { icon: "🛡️", label: "Après effraction", price: "dès 140 €" },
      { icon: "🔒", label: "Cylindre à changer", price: "dès 130 €" },
    ],
    priceNote:
      "Tarif annoncé au téléphone et confirmé par SMS avant le départ. C'est ce qui distingue un serrurier d'un rabatteur.",
  },
};

/* ══ CONFORMITÉ ════════════════════════════════════════════════ */

const ELECTRICIEN: ArtisanKit = {
  accent: "#F5C518",
  accentDark: "#C79C0B",
  hero: "/templates/electricien-hero.jpg",
  about: "/templates/electricien-mise-aux-normes.jpg",
  portrait: "/templates/electricien-portrait.webp",
  gallery: [
    "/templates/electricien-depannage.jpg",
    u("photo-1635335874521-7987db781153", 700),
    u("photo-1576446470246-499c738d1c8e", 700),
    u("photo-1601462904263-f2fa0c851cb9", 700),
    u("photo-1558002038-1055907df827", 700),
    "/templates/electricien-mise-aux-normes.jpg",
  ],
  services: [
    { name: "Mise aux normes du tableau", desc: "Remplacement du tableau, différentiels 30 mA et repérage des circuits.", price: 890, from: true, cat: "Conformité" },
    { name: "Diagnostic électrique", desc: "Contrôle des 6 points de sécurité, rapport écrit remis le jour même.", price: 150, cat: "Conformité" },
    { name: "Installation complète", desc: "Neuf ou rénovation totale, câblage NF C 15-100, du plan à la mise sous tension.", price: 90, from: true, unit: "/m²", cat: "Installation" },
    { name: "Dépannage", desc: "Court-circuit, disjoncteur qui saute, prise morte : origine trouvée avant de facturer.", price: 95, from: true, cat: "Dépannage" },
    { name: "Domotique et éclairage", desc: "Volets, éclairage pilotable, thermostat connecté, sans abonnement imposé.", price: 450, from: true, cat: "Confort" },
    { name: "Borne de recharge", desc: "Borne 7 kW posée et déclarée, éligible à la prime ADVENIR.", price: 1190, from: true, cat: "Confort" },
  ],
  testimonials: [
    { author: "Jean-Marc D.", rating: 5, comment: "Tableau de 1978 remplacé en une journée. Tout est repéré, étiqueté, je m'y retrouve enfin.", date: "mars 2024" },
    { author: "Claire V.", rating: 5, comment: "Diagnostic avant achat : rapport clair, ça m'a servi à négocier le prix de la maison.", date: "février 2024" },
    { author: "Ludovic P.", rating: 5, comment: "Disjoncteur qui sautait depuis six mois. Panne trouvée en une heure, réparée dans la foulée.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} remet aux normes des installations que personne n'a regardées depuis trente ans. Chaque circuit est repéré, chaque intervention est tracée, et le tableau qu'on laisse derrière soi se lit sans mode d'emploi.",
  ticker: ["Conforme NF C 15-100", "Devis gratuit", "Dépannage 7j/7", "Garantie décennale"],
  offer: "vitrine",
  bookingWord: "le planning",
  promise: { lead: "Votre tableau est-il", strong: "aux normes ?", sub: "Six points décident de la sécurité d'un logement. Voici lesquels — et où vous en êtes." },
  facts: [
    { k: "6 points", v: "contrôlés sur chaque diagnostic" },
    { k: "48 h", v: "pour un rapport écrit complet" },
    { k: "25 ans", v: "d'installations conformes" },
  ],
  zone: ["Centre-ville", "Périphérie", "30 km alentour"],
  garanties: ["Qualifelec", "Garantie décennale", "Consuel"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les",
    catalogueSub: "interventions",
    catalogueNote: "Tarifs indicatifs TTC. Le diagnostic est déduit du devis s'il donne lieu à travaux.",
    gallery: "Les",
    gallerySub: "installations",
    cta: "Demander un diagnostic",
    ctaFinal: "demander",
  },
  module: {
    kind: "conformite",
    norme: "NF C 15-100",
    checks: [
      { point: "Appareil général de coupure", why: "Couper toute l'installation d'un seul geste, accessible depuis l'entrée.", ok: true },
      { point: "Différentiel 30 mA", why: "Ce qui coupe le courant avant que le corps ne serve de chemin à la terre.", ok: true },
      { point: "Prise de terre", why: "Sans elle, un appareil en défaut met la carcasse sous tension.", ok: false },
      { point: "Protection par circuit", why: "Un disjoncteur adapté à chaque section de câble, pas un fusible universel.", ok: true },
      { point: "Liaison équipotentielle", why: "Salle de bain : toutes les masses métalliques reliées au même potentiel.", ok: false },
      { point: "Matériel sans risque de contact", why: "Aucun conducteur nu accessible, aucune vieille prise sans obturateur.", ok: true },
    ],
  },
};

/* ══ THERMIQUE ═════════════════════════════════════════════════ */

const CHAUFFAGISTE: ArtisanKit = {
  accent: "#E2683C",
  accentDark: "#B44B25",
  hero: u("photo-1504328345606-18bbc8c9d7d1", 1400),
  about: u("photo-1650551182991-b07558247564", 1000),
  portrait: "/templates/chauffagiste-portrait.webp",
  gallery: [
    u("photo-1650551182956-47efa0f90b64", 700),
    u("photo-1639866496281-573747d7051f", 700),
    u("photo-1710829558487-53baf9e26003", 700),
    u("photo-1669729227685-770f727fb709", 700),
    u("photo-1518276779712-dfdcb9daa7a1", 700),
    u("photo-1504328345606-18bbc8c9d7d1", 700),
  ],
  services: [
    { name: "Entretien annuel chaudière", desc: "Obligatoire chaque année : nettoyage, réglages, attestation remise sur place.", price: 129, cat: "Entretien" },
    { name: "Contrat d'entretien", desc: "Visite annuelle, dépannages prioritaires et pièces d'usure comprises.", price: 19, unit: "/mois", cat: "Entretien" },
    { name: "Pompe à chaleur air/eau", desc: "Étude thermique, pose et mise en service. Aides déduites du devis.", price: 9500, from: true, cat: "Installation" },
    { name: "Remplacement de chaudière", desc: "Dépose de l'ancienne, chaudière gaz THPE, évacuation et mise en route.", price: 3900, from: true, cat: "Installation" },
    { name: "Dépannage chauffage", desc: "Plus d'eau chaude, radiateurs froids, code défaut : diagnostic sous 24 h.", price: 95, from: true, cat: "Dépannage" },
    { name: "Étude et devis", desc: "Bilan thermique du logement et simulation des aides, sans engagement.", price: 0, cat: "Devis" },
  ],
  testimonials: [
    { author: "Michel A.", rating: 5, comment: "PAC posée en trois jours, dossier MaPrimeRénov' monté par eux. Facture divisée par deux cet hiver.", date: "mars 2024" },
    { author: "Sylvie G.", rating: 5, comment: "Contrat d'entretien depuis quatre ans. Panne un samedi, réparée le lundi matin. Zéro discussion.", date: "février 2024" },
    { author: "Bernard F.", rating: 4, comment: "Bon travail sur la chaudière. Le dossier d'aides a pris plus de temps que prévu.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} remplace des chaudières qui coûtent plus cher à chauffer qu'à changer. Bilan thermique avant le devis, aides calculées et montées avec vous, et l'entretien annuel qui garde la garantie valable.",
  ticker: ["RGE QualiPAC", "Aides déduites du devis", "Entretien annuel", "Dépannage sous 24 h"],
  offer: "vitrine",
  bookingWord: "le planning",
  promise: { lead: "Chauffer moins cher,", strong: "dès cet hiver.", sub: "Bilan thermique, aides calculées, facture annuelle avant/après. Les chiffres avant la signature." },
  facts: [
    { k: "−58 %", v: "de facture après passage en PAC" },
    { k: "RGE", v: "certification exigée pour les aides" },
    { k: "24 h", v: "de délai de dépannage sous contrat" },
  ],
  zone: ["Centre-ville", "Périphérie", "40 km alentour"],
  garanties: ["RGE QualiPAC", "Garantie décennale", "Aides MaPrimeRénov'"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les",
    catalogueSub: "prestations",
    catalogueNote: "Tarifs TTC avant aides. Le montant des aides est calculé sur votre situation réelle.",
    gallery: "Les",
    gallerySub: "installations",
    cta: "Demander une étude",
    ctaFinal: "demander",
  },
  module: {
    kind: "thermique",
    before: 2280,
    after: 960,
    aides: [
      { name: "MaPrimeRénov'", amount: "jusqu'à 5 000 €" },
      { name: "Certificats d'économie d'énergie", amount: "jusqu'à 4 000 €" },
      { name: "TVA réduite", amount: "5,5 %" },
    ],
    entretienNote:
      "L'entretien annuel est obligatoire et conditionne la garantie du constructeur. On vous rappelle avant la date, vous n'avez pas à y penser.",
  },
};

/* ══ CHANTIER ══════════════════════════════════════════════════ */

const COUVREUR: ArtisanKit = {
  accent: "#B4552F",
  accentDark: "#8A3E20",
  hero: u("photo-1635424709845-3a85ad5e1f5e", 1400),
  about: u("photo-1726589004565-bedfba94d3a2", 1000),
  portrait: "/templates/couvreur-portrait.webp",
  gallery: [
    u("photo-1681049400158-0ff6249ac315", 700),
    u("photo-1605450099279-533bd3ce379a", 700),
    u("photo-1528223871781-8f4c984f6164", 700),
    u("photo-1763665814538-8ba04597286c", 700),
    u("photo-1504241932178-447c4c934e98", 700),
    u("photo-1654531015087-8cc3d04d1b2d", 700),
  ],
  services: [
    { name: "Réfection complète de toiture", desc: "Dépose, écran sous-toiture, liteaunage et couverture neuve.", price: 120, from: true, unit: "/m²", cat: "Toiture" },
    { name: "Réparation ponctuelle", desc: "Tuiles cassées, faîtage descellé, solin à reprendre.", price: 350, from: true, cat: "Toiture" },
    { name: "Démoussage et traitement", desc: "Nettoyage basse pression, traitement hydrofuge, gouttières dégagées.", price: 18, from: true, unit: "/m²", cat: "Entretien" },
    { name: "Zinguerie", desc: "Gouttières, chéneaux, noues et habillage de cheminée en zinc.", price: 65, from: true, unit: "/ml", cat: "Zinguerie" },
    { name: "Isolation des combles", desc: "Soufflage ou panneaux, éligible aux aides à la rénovation.", price: 45, from: true, unit: "/m²", cat: "Isolation" },
    { name: "Visite et devis", desc: "Montée sur toiture, photos remises, devis détaillé sous 48 h.", price: 0, cat: "Devis" },
  ],
  testimonials: [
    { author: "Robert C.", rating: 5, comment: "Toiture de 140 m² refaite en deux semaines, échafaudage monté proprement, chantier nettoyé chaque soir.", date: "mars 2024" },
    { author: "Martine L.", rating: 5, comment: "Fuite après la tempête : bâchée le jour même, réparée la semaine suivante. Photos avant/après envoyées.", date: "février 2024" },
    { author: "Alain D.", rating: 5, comment: "Devis clair, ligne par ligne, sans surprise à la fin. Le prix du départ était le prix d'arrivée.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} monte sur les toits que les autres photographient au drone. Diagnostic avec photos à l'appui, devis ligne par ligne, échafaudage aux normes et chantier balayé tous les soirs.",
  ticker: ["Garantie décennale", "Devis sous 48 h", "Échafaudage aux normes", "Chantier nettoyé"],
  offer: "vitrine",
  bookingWord: "le planning",
  promise: { lead: "Une toiture,", strong: "ça se voit venir.", sub: "Cinq signes annoncent la réfection. Les repérer à temps coûte dix fois moins cher." },
  facts: [
    { k: "48 h", v: "pour un devis détaillé après visite" },
    { k: "10 ans", v: "de garantie décennale sur la couverture" },
    { k: "0 €", v: "de frais de visite et de diagnostic" },
  ],
  zone: ["Centre-ville", "Périphérie", "50 km alentour"],
  garanties: ["Garantie décennale", "RGE", "Assurance chantier"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les",
    catalogueSub: "travaux",
    catalogueNote: "Prix indicatifs au m² posé, fournitures comprises. Le devis est établi après montée sur toiture.",
    gallery: "Les",
    gallerySub: "toitures",
    cta: "Demander une visite",
    ctaFinal: "demander",
  },
  module: {
    kind: "chantier",
    alertes: [
      "Des tuiles glissées ou cassées visibles depuis le sol",
      "Une auréole d'humidité au plafond de l'étage",
      "De la mousse épaisse sur le versant nord",
      "Des gouttières qui débordent à chaque orage",
      "Une charpente qui blanchit ou qui s'effrite",
    ],
    steps: [
      { title: "La visite", desc: "Montée sur toiture, photos de chaque désordre, mesures relevées.", delay: "sous 72 h" },
      { title: "Le devis", desc: "Ligne par ligne : dépose, fournitures, main-d'œuvre, échafaudage, évacuation.", delay: "sous 48 h" },
      { title: "Le chantier", desc: "Échafaudage, protection des abords, réfection, nettoyage quotidien.", delay: "1 à 3 semaines" },
      { title: "La réception", desc: "Visite ensemble, photos finales, attestation décennale remise.", delay: "le dernier jour" },
    ],
  },
};

const MACON: ArtisanKit = {
  accent: "#8C7256",
  accentDark: "#6B5540",
  hero: u("photo-1704005445445-2747074be8ac", 1400),
  about: u("photo-1701850009190-2859ba2aeea6", 1000),
  portrait: "/templates/macon-portrait.webp",
  gallery: [
    u("photo-1657401972566-6679de283e1b", 700),
    u("photo-1546709843-e35cf3d3002d", 700),
    u("photo-1577416214297-e6a028603b44", 700),
    u("photo-1690235758424-2e34a71e68a2", 700),
    u("photo-1504307651254-35680f356dfd", 700),
    u("photo-1568987102551-93aab3f928b7", 700),
  ],
  services: [
    { name: "Extension et agrandissement", desc: "Fondations, élévation, dalle et raccord à l'existant.", price: 1400, from: true, unit: "/m²", cat: "Gros œuvre" },
    { name: "Ouverture de mur porteur", desc: "Étude de descente de charges, étaiement, pose de linteau IPN.", price: 2200, from: true, cat: "Gros œuvre" },
    { name: "Dalle béton et terrasse", desc: "Décaissement, ferraillage, coulage et finition talochée ou balayée.", price: 90, from: true, unit: "/m²", cat: "Extérieur" },
    { name: "Mur de clôture", desc: "Parpaing enduit, pierre ou bloc à bancher, avec fondation adaptée.", price: 180, from: true, unit: "/ml", cat: "Extérieur" },
    { name: "Ravalement et enduit", desc: "Piquage, réparation des fissures, enduit monocouche ou à la chaux.", price: 55, from: true, unit: "/m²", cat: "Façade" },
    { name: "Étude et devis", desc: "Visite, relevé, faisabilité et devis détaillé. Gratuit et sans engagement.", price: 0, cat: "Devis" },
  ],
  testimonials: [
    { author: "Philippe R.", rating: 5, comment: "Extension de 28 m² livrée dans les délais annoncés. Planning tenu semaine par semaine.", date: "mars 2024" },
    { author: "Corinne B.", rating: 5, comment: "Ouverture d'un mur porteur : bureau d'études, étaiement, tout était carré. Zéro fissure depuis.", date: "février 2024" },
    { author: "Yannick M.", rating: 4, comment: "Beau travail sur la terrasse. Une semaine de retard à cause de la pluie, prévenu à chaque fois.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} fait le travail qu'on ne voit plus une fois la maison finie : les fondations droites, les murs d'aplomb, les charges qui descendent là où il faut. Planning affiché, avancement photographié, chantier laissé propre.",
  ticker: ["Garantie décennale", "Planning tenu", "Devis détaillé", "Chantier assuré"],
  offer: "vitrine",
  bookingWord: "le planning",
  promise: { lead: "Le gros œuvre,", strong: "étape par étape.", sub: "De la première visite à la réception : ce qui se passe, quand, et ce que ça coûte." },
  facts: [
    { k: "72 h", v: "pour une visite de faisabilité" },
    { k: "10 ans", v: "de garantie décennale sur la structure" },
    { k: "0 €", v: "d'étude et de devis" },
  ],
  zone: ["Centre-ville", "Périphérie", "40 km alentour"],
  garanties: ["Garantie décennale", "Bureau d'études partenaire", "Assurance chantier"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les",
    catalogueSub: "ouvrages",
    catalogueNote: "Prix indicatifs, fournitures comprises. Le devis suit l'étude de faisabilité.",
    gallery: "Les",
    gallerySub: "réalisations",
    cta: "Demander une étude",
    ctaFinal: "demander",
  },
  module: {
    kind: "chantier",
    alertes: [
      "Une fissure qui s'élargit d'une saison à l'autre",
      "Un plancher qui prend de la pente",
      "Une façade qui se décolle par plaques",
      "Un mur de clôture qui bascule",
      "De l'humidité qui remonte au bas des murs",
    ],
    steps: [
      { title: "L'étude", desc: "Relevé sur place, faisabilité, descente de charges si structure touchée.", delay: "sous 72 h" },
      { title: "Le devis", desc: "Poste par poste : terrassement, matériaux, main-d'œuvre, évacuation.", delay: "sous 5 jours" },
      { title: "Le chantier", desc: "Planning affiché, avancement photographié, points hebdomadaires.", delay: "3 à 10 semaines" },
      { title: "La réception", desc: "Visite contradictoire, levée des réserves, attestation décennale.", delay: "le dernier jour" },
    ],
  },
};

/* ══ ÉTABLI ════════════════════════════════════════════════════ */

const MENUISIER: ArtisanKit = {
  accent: "#A0673A",
  accentDark: "#7A4C29",
  hero: u("photo-1590880795696-20c7dfadacde", 1400),
  about: u("photo-1631396326646-c06a935ff3a6", 1000),
  portrait: "/templates/menuisier-portrait.webp",
  gallery: [
    u("photo-1497219055242-93359eeed651", 700),
    u("photo-1597960194599-22929afc25b1", 700),
    u("photo-1497218770144-3fea6dbc33fe", 700),
    u("photo-1594580701468-e5678582b8ce", 700),
    u("photo-1426927308491-6380b6a9936f", 700),
    u("photo-1631396326646-c06a935ff3a6", 700),
  ],
  services: [
    { name: "Cuisine sur mesure", desc: "Plan 3D, façades massives ou plaquées, plan de travail au choix.", price: 6500, from: true, cat: "Agencement" },
    { name: "Dressing et bibliothèque", desc: "Dessiné pour la pièce, jusqu'au centimètre sous rampant.", price: 1800, from: true, cat: "Agencement" },
    { name: "Escalier bois", desc: "Droit, quart tournant ou hélicoïdal, marches en chêne massif.", price: 4200, from: true, cat: "Structure" },
    { name: "Fenêtres et portes bois", desc: "Sur mesure, double vitrage, pose et finition comprises.", price: 850, from: true, cat: "Menuiserie" },
    { name: "Terrasse et bardage", desc: "Douglas, mélèze ou composite, lambourdage ventilé.", price: 130, from: true, unit: "/m²", cat: "Extérieur" },
    { name: "Plan et devis", desc: "Relevé sur place, plan 3D et devis détaillé, sans engagement.", price: 0, cat: "Devis" },
  ],
  testimonials: [
    { author: "Isabelle N.", rating: 5, comment: "Une bibliothèque sous rampant que personne d'autre ne voulait faire. Au millimètre.", date: "mars 2024" },
    { author: "Guillaume P.", rating: 5, comment: "Cuisine en chêne massif, plan 3D avant de commencer, livrée à la date dite. Du vrai bois, pas du panneau.", date: "février 2024" },
    { author: "Anne-Sophie V.", rating: 5, comment: "Escalier quart tournant magnifique. Il a passé trois heures à expliquer les essences avant de chiffrer.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} travaille le bois debout : relevé sur place, plan dessiné, essence choisie avec vous, puis l'atelier. Ce qui sort d'ici est fait pour votre pièce et pour durer plus longtemps que la mode du moment.",
  ticker: ["Bois massif", "Plan 3D avant devis", "Fabrication à l'atelier", "Garantie décennale"],
  offer: "vitrine",
  bookingWord: "l'atelier",
  promise: { lead: "Le bois d'abord,", strong: "le meuble ensuite.", sub: "Chaque essence a son grain, son prix et sa durée de vie. Choisissez la matière avant la forme." },
  facts: [
    { k: "100 %", v: "fabriqué à l'atelier, pas assemblé" },
    { k: "4 à 8 sem.", v: "du plan validé à la pose" },
    { k: "0 €", v: "de plan 3D et de devis" },
  ],
  zone: ["Centre-ville", "Périphérie", "60 km alentour"],
  garanties: ["Bois PEFC", "Garantie décennale", "Fabrication française"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "L'atelier",
    catalogueSub: "et ses prix",
    catalogueNote: "Prix de départ pour une fabrication sur mesure, pose comprise.",
    gallery: "Les",
    gallerySub: "réalisations",
    cta: "Demander un plan",
    ctaFinal: "demander",
  },
  module: {
    kind: "etabli",
    essences: [
      { name: "Chêne", color: "#B08248", note: "Dur, stable, veiné. La référence pour un escalier ou un plan de travail." },
      { name: "Frêne", color: "#D8BD90", note: "Clair et souple, il encaisse les chocs sans se fendre." },
      { name: "Noyer", color: "#6B4529", note: "Sombre et profond, réservé aux pièces qu'on veut voir." },
      { name: "Douglas", color: "#C98D5F", note: "Naturellement résistant dehors : terrasse, bardage, abri." },
      { name: "Hêtre", color: "#CBA579", note: "Régulier et bon marché, parfait pour les intérieurs de meuble." },
    ],
    delaiNote:
      "Comptez quatre à huit semaines entre le plan validé et la pose : le bois se choisit, se sèche et se travaille, il ne se sort pas d'un carton.",
  },
};

/* ══ SURFACE ═══════════════════════════════════════════════════ */

const CARRELEUR: ArtisanKit = {
  accent: "#2F6E6A",
  accentDark: "#22514E",
  hero: u("photo-1656646523907-97b094c7e63a", 1400),
  about: u("photo-1590611329686-7494753d96e0", 1000),
  portrait: "/templates/carreleur-portrait.webp",
  gallery: [
    u("photo-1628602813485-4e8b09442e98", 700),
    u("photo-1636200534256-c08268363482", 700),
    u("photo-1631035255691-7e40af32f2ea", 700),
    u("photo-1758482355865-af58a68e0c68", 700),
    u("photo-1770926005888-1503cab85fcd", 700),
    u("photo-1564540579594-0930edb6de43", 700),
  ],
  services: [
    { name: "Pose de carrelage sol", desc: "Droite, en diagonale ou décalée, sur chape ou ancien carrelage.", price: 45, from: true, unit: "/m²", cat: "Pose" },
    { name: "Faïence murale", desc: "Salle de bain et crédence de cuisine, coupes soignées aux angles.", price: 55, from: true, unit: "/m²", cat: "Pose" },
    { name: "Grand format et XXL", desc: "Dalles jusqu'à 120 × 120, pose à double encollage sur support préparé.", price: 75, from: true, unit: "/m²", cat: "Pose" },
    { name: "Douche à l'italienne", desc: "Étanchéité sous carrelage, pente calculée, receveur maçonné.", price: 1400, from: true, cat: "Salle de bain" },
    { name: "Ragréage et préparation", desc: "Mise à niveau du support — sans ça, aucune pose ne tient droit.", price: 22, from: true, unit: "/m²", cat: "Préparation" },
    { name: "Métré et devis", desc: "Relevé des surfaces, calepinage proposé, devis gratuit.", price: 0, cat: "Devis" },
  ],
  testimonials: [
    { author: "Delphine C.", rating: 5, comment: "60 m² de grand format posés sans un joint de travers. Le calepinage proposé était mieux que mon idée.", date: "mars 2024" },
    { author: "Franck L.", rating: 5, comment: "Douche à l'italienne impeccable, étanchéité soignée. Deux ans après, aucune trace d'humidité.", date: "février 2024" },
    { author: "Aurélie D.", rating: 5, comment: "Devis au m² clair dès la visite. Chantier propre, découpes faites dehors, pas de poussière partout.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} pose du carrelage qui reste droit dix ans après. Support préparé avant tout — c'est là que se joue le résultat —, calepinage réfléchi, joints réguliers et découpes faites à l'extérieur.",
  ticker: ["Devis au m²", "Support préparé", "Calepinage étudié", "Garantie décennale"],
  offer: "vitrine",
  bookingWord: "le planning",
  promise: { lead: "Combien pour", strong: "votre pièce ?", sub: "Choisissez la pièce, on affiche l'ordre de grandeur. Le devis ferme suit la visite." },
  facts: [
    { k: "45 €/m²", v: "pose sol, à partir de" },
    { k: "1 mm", v: "de tolérance de planéité au m" },
    { k: "0 €", v: "de métré et de devis" },
  ],
  zone: ["Centre-ville", "Périphérie", "35 km alentour"],
  garanties: ["Garantie décennale", "Artisan assuré", "Pose DTU"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les",
    catalogueSub: "poses",
    catalogueNote: "Prix au m² posé, hors fourniture du carrelage. Préparation du support chiffrée à part.",
    gallery: "Les",
    gallerySub: "chantiers",
    cta: "Demander un métré",
    ctaFinal: "demander",
  },
  module: {
    kind: "surface",
    pricePerM2: 45,
    pieces: [
      { label: "Salle de bain", m2: 6 },
      { label: "Cuisine", m2: 12 },
      { label: "Séjour", m2: 30 },
      { label: "Maison entière", m2: 90 },
    ],
    finitions: [
      { name: "Pose droite", color: "#DCD5CB", note: "La plus sobre, la moins coûteuse en découpes." },
      { name: "Pose en diagonale", color: "#C9BFB1", note: "Agrandit visuellement, mais ajoute 10 % de chutes." },
      { name: "Chevrons", color: "#B3A491", note: "Le motif qui se remarque. Demande un support parfait." },
      { name: "Grand format", color: "#9E9382", note: "Moins de joints, plus d'exigence sur la planéité." },
    ],
  },
};

const PEINTRE: ArtisanKit = {
  accent: "#3F5EA8",
  accentDark: "#2C4480",
  hero: u("photo-1693985120993-e9b203ce7631", 1400),
  about: u("photo-1715021927612-63269dacb5ea", 1000),
  portrait: "/templates/peintre-portrait.webp",
  gallery: [
    u("photo-1688372198189-de6a51777a81", 700),
    u("photo-1749207325171-ae2294e277ed", 700),
    u("photo-1688372199140-cade7ae820fe", 700),
    u("photo-1739145974146-c310088417ca", 700),
    u("photo-1634638415860-cef1aafb60c4", 700),
    u("photo-1562259949-e8e7689d7828", 700),
  ],
  services: [
    { name: "Peinture murs et plafonds", desc: "Deux couches sur support préparé, protection complète des sols.", price: 28, from: true, unit: "/m²", cat: "Intérieur" },
    { name: "Préparation des supports", desc: "Rebouchage, enduit de lissage, ponçage. Ce qui décide du rendu final.", price: 18, from: true, unit: "/m²", cat: "Préparation" },
    { name: "Boiseries et menuiseries", desc: "Portes, plinthes, radiateurs : dégraissage, sous-couche, laque.", price: 90, from: true, cat: "Intérieur" },
    { name: "Façade et extérieur", desc: "Nettoyage, traitement, peinture pliolite ou siloxane selon l'exposition.", price: 42, from: true, unit: "/m²", cat: "Extérieur" },
    { name: "Papier peint et toile de verre", desc: "Pose soignée, raccords ajustés, angles nets.", price: 24, from: true, unit: "/m²", cat: "Revêtement" },
    { name: "Devis et conseil couleur", desc: "Visite, mesures, nuancier sur place et devis détaillé.", price: 0, cat: "Devis" },
  ],
  testimonials: [
    { author: "Véronique T.", rating: 5, comment: "Appartement entier en cinq jours, meubles bâchés, sols protégés, pas une trace au plafond.", date: "mars 2024" },
    { author: "Didier M.", rating: 5, comment: "Il a insisté pour refaire les enduits avant de peindre. Il avait raison, le rendu est net.", date: "février 2024" },
    { author: "Léa B.", rating: 5, comment: "Conseil couleur très juste sur une pièce sombre. Devis respecté à l'euro près.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} passe plus de temps à préparer qu'à peindre — c'est ce qui sépare un mur net d'un mur qui cloque au bout d'un an. Sols protégés, meubles bâchés, chantier rendu propre et prêt à vivre.",
  ticker: ["Devis au m²", "Supports préparés", "Peintures A+", "Chantier protégé"],
  offer: "vitrine",
  bookingWord: "le planning",
  promise: { lead: "La couleur,", strong: "avant les pinceaux.", sub: "Choisissez une teinte, voyez la pièce changer. Le devis se calcule ensuite au m²." },
  facts: [
    { k: "28 €/m²", v: "peinture deux couches, à partir de" },
    { k: "A+", v: "peintures à faibles émissions" },
    { k: "0 €", v: "de conseil couleur et de devis" },
  ],
  zone: ["Centre-ville", "Périphérie", "30 km alentour"],
  garanties: ["Artisan assuré", "Peintures écolabel", "Chantier protégé"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les",
    catalogueSub: "prestations",
    catalogueNote: "Prix au m² peint, fournitures comprises. La préparation est chiffrée séparément.",
    gallery: "Les",
    gallerySub: "chantiers",
    cta: "Demander un devis",
    ctaFinal: "demander",
  },
  module: {
    kind: "surface",
    pricePerM2: 28,
    pieces: [
      { label: "Une chambre", m2: 38 },
      { label: "Un séjour", m2: 70 },
      { label: "Un appartement", m2: 180 },
      { label: "Une maison", m2: 320 },
    ],
    finitions: [
      { name: "Blanc cassé", color: "#F2EDE4", note: "Agrandit, pardonne tout, se salit vite dans un couloir." },
      { name: "Greige", color: "#C9C0B4", note: "Chaud sans être jaune. Le passe-partout des pièces à vivre." },
      { name: "Vert sauge", color: "#8FA089", note: "Apaise une chambre, mange la lumière d'une pièce nord." },
      { name: "Bleu profond", color: "#33465F", note: "Superbe sur un mur unique, écrasant sur les quatre." },
      { name: "Terracotta", color: "#B5674A", note: "Réchauffe un intérieur clair, difficile à associer." },
    ],
  },
};

/* ══ JARDIN ════════════════════════════════════════════════════ */

const PAYSAGISTE: ArtisanKit = {
  accent: "#4A7A3B",
  accentDark: "#365B2B",
  hero: u("photo-1416879595882-3373a0480b5b", 1400),
  about: u("photo-1761637822930-fb1c1a3df94d", 1000),
  portrait: "/templates/paysagiste-portrait.webp",
  gallery: [
    u("photo-1558904541-efa843a96f01", 700),
    u("photo-1585320806297-9794b3e4eeae", 700),
    u("photo-1777539638731-162153332dc5", 700),
    u("photo-1755121855969-55e405c0deb5", 700),
    u("photo-1761166518480-49279513d65f", 700),
    u("photo-1416879595882-3373a0480b5b", 700),
  ],
  services: [
    { name: "Entretien annuel", desc: "Tonte, taille, désherbage et ramassage, réparti sur l'année.", price: 79, unit: "/mois", cat: "Entretien" },
    { name: "Taille de haies", desc: "Taille de formation ou d'entretien, déchets évacués.", price: 12, from: true, unit: "/ml", cat: "Entretien" },
    { name: "Élagage et abattage", desc: "Grimpeur certifié, démontage par sections, rognage de souche.", price: 350, from: true, cat: "Arbres" },
    { name: "Création de jardin", desc: "Plan, choix des végétaux selon l'exposition, plantation et paillage.", price: 60, from: true, unit: "/m²", cat: "Création" },
    { name: "Terrasse et allée", desc: "Bois, dallage ou gravier stabilisé, avec drainage.", price: 130, from: true, unit: "/m²", cat: "Aménagement" },
    { name: "Visite et devis", desc: "Relevé du terrain, plan d'intention et devis. Gratuit.", price: 0, cat: "Devis" },
  ],
  testimonials: [
    { author: "Christine P.", rating: 5, comment: "Contrat d'entretien depuis trois ans : ils passent sans que j'aie à appeler, le jardin est toujours net.", date: "mars 2024" },
    { author: "Olivier G.", rating: 5, comment: "Création complète du jardin. Le plan tenait compte de l'ombre du voisin, tout a repris.", date: "février 2024" },
    { author: "Monique F.", rating: 5, comment: "Élagage de deux grands chênes en sécurité, tout évacué le jour même. Impeccable.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} conçoit des jardins qui tiennent la saison suivante : des végétaux choisis pour l'exposition réelle du terrain, un paillage qui limite l'arrosage, et un entretien réparti sur l'année plutôt qu'un grand ménage de printemps.",
  ticker: ["Contrat à l'année", "Certiphyto", "Déchets évacués", "Devis gratuit"],
  offer: "vitrine",
  bookingWord: "le planning",
  promise: { lead: "Un jardin,", strong: "ça se tient toute l'année.", sub: "Ce qu'on fait chez vous, saison par saison — et ce qui arrive si on saute une étape." },
  facts: [
    { k: "4 passages", v: "par an dans un contrat d'entretien" },
    { k: "Certiphyto", v: "traitements encadrés et déclarés" },
    { k: "0 €", v: "de visite et de plan d'intention" },
  ],
  zone: ["Centre-ville", "Périphérie", "35 km alentour"],
  garanties: ["Certiphyto", "Reprise garantie 1 an", "Déchets évacués"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les",
    catalogueSub: "prestations",
    catalogueNote: "Tarifs indicatifs TTC. Le contrat annuel lisse le coût sur douze mois.",
    gallery: "Les",
    gallerySub: "jardins",
    cta: "Demander une visite",
    ctaFinal: "demander",
  },
  module: {
    kind: "jardin",
    saisons: [
      { name: "Printemps", months: "mars — mai", tasks: ["Première tonte et scarification", "Taille des arbustes à floraison d'été", "Plantation des vivaces", "Paillage avant les chaleurs"] },
      { name: "Été", months: "juin — août", tasks: ["Tonte toutes les deux semaines", "Arrosage raisonné et vérification du goutte-à-goutte", "Taille des haies après nidification", "Désherbage des massifs"] },
      { name: "Automne", months: "sept. — nov.", tasks: ["Ramassage des feuilles", "Taille de structure des arbustes", "Plantation des arbres et des bulbes", "Dernière tonte haute"] },
      { name: "Hiver", months: "déc. — févr.", tasks: ["Élagage des grands sujets au repos", "Entretien du matériel et des allées", "Traitement d'hiver des fruitiers", "Préparation des massifs"] },
    ],
    contratNote:
      "Un jardin entretenu quatre fois par an coûte moins cher qu'un rattrapage tous les trois ans — et il ne repart pas de zéro à chaque printemps.",
  },
};

/* ── Registre ───────────────────────────────────────────────── */

export type ArtisanKey =
  | "plombier"
  | "serrurier"
  | "electricien"
  | "chauffagiste"
  | "couvreur"
  | "macon"
  | "menuisier"
  | "carreleur"
  | "peintre"
  | "paysagiste";

export const ARTISAN_KITS: Record<ArtisanKey, ArtisanKit> = {
  plombier: PLOMBIER,
  serrurier: SERRURIER,
  electricien: ELECTRICIEN,
  chauffagiste: CHAUFFAGISTE,
  couvreur: COUVREUR,
  macon: MACON,
  menuisier: MENUISIER,
  carreleur: CARRELEUR,
  peintre: PEINTRE,
  paysagiste: PAYSAGISTE,
};

/**
 * Métier (libellé scrapé) → kit artisan, ou `null` hors périmètre.
 *
 * Comme `matchNiche`, le null est le point important : un métier inconnu ne doit
 * pas hériter par défaut de la page du plombier.
 */
const MATCHERS: Array<[RegExp, ArtisanKey]> = [
  [/(serrur|ferronn|m[eé]taller|garde[- ]?corps|portail|blindage)/, "serrurier"],
  [/(plomb|sanitaire|salle de bain|d[eé]bouch)/, "plombier"],
  [/([eé]lectric|domotique|[eé]lectricit)/, "electricien"],
  [/(chauffag|pompe [aà] chaleur|\bpac\b|climatis|\bclim\b|chaudi)/, "chauffagiste"],
  [/(couvreur|couverture|toiture|zingu|ardoise|tuile|charpent)/, "couvreur"],
  [/(ma[cç]on|gros [oœ]uvre|terrassement|pierre de taille|ravalement)/, "macon"],
  [/(menuis|[eé]b[eé]nist|agencement|cuisinist|parquet|escalier)/, "menuisier"],
  [/(carrel|fa[iï]ence|mosa[iï]que|chape)/, "carreleur"],
  [/(peintre|peinture|plaquiste|pl[aâ]trier|placo|enduit)/, "peintre"],
  [/(paysag|jardin|[eé]lagage|espaces? verts?|[eé]lagueur)/, "paysagiste"],
];

export function matchArtisan(metier?: string | null): ArtisanKey | null {
  const m = (metier ?? "").toLowerCase().trim();
  if (!m) return null;
  if (m in ARTISAN_KITS) return m as ArtisanKey;
  for (const [re, key] of MATCHERS) if (re.test(m)) return key;
  return null;
}

/** Kit du métier, sinon celui du plombier (le plus servi). */
export function artisanKitFor(metier?: string | null): ArtisanKit {
  return ARTISAN_KITS[matchArtisan(metier) ?? "plombier"];
}
