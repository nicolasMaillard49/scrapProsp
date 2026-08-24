// Kits de CONTENU par niche (prestations, images, avis, libellés, offre).
//
// La direction artistique, elle, n'est PAS ici : chaque métier a désormais son
// propre composant de maquette (app/maquette/templates/niches/). Un coiffeur et
// une esthéticienne ne doivent pas recevoir la même page repeinte — ils ne
// vendent pas la même chose et ne se regardent pas dans le même miroir.
//
// Ce fichier reste la source unique du contenu : un kit décrit ce que le métier
// vend, ce qu'on lui montre en photo, ce que ses clients disent de lui, et
// surtout QUELLE OFFRE NMF la maquette met en avant (cf. `offer`).
//
// Images : IDs Unsplash vérifiés (HTTP 200). {ville}/{name} = placeholders.

export interface NicheService {
  name: string;
  desc: string;
  /** En euros. 0 = affiché « Offert » (consultation, devis). */
  price: number;
  cat: string;
  duration?: number; // min — omis pour les niches sans créneau (resto, fleuriste)
  /** Prix à partir de (affiche « dès 250 € »). */
  from?: boolean;
}
export interface NicheTestimonial {
  author: string;
  rating: number;
  comment: string;
  date: string;
}

/**
 * L'offre NMF mise en avant en bas de maquette.
 *
 *  - `booking` → la maquette montre un module de réservation en ligne. C'est le
 *    Site Réservation du vault (500 € HT) : agenda, créneaux, rappels.
 *  - `vitrine` → pas de réservation, la maquette vend la présence et l'appel.
 *    C'est le Site Vitrine (300 € HT).
 *
 * Le prix affiché DOIT suivre ce que la maquette montre réellement : promettre
 * 300 € sous un module de réservation, c'est vendre à perte dès l'appel.
 */
export type OfferKind = "booking" | "vitrine";

export interface NicheKit {
  accent: string;
  accentDark: string;
  hero: string;
  about: string;
  gallery: string[];
  services: NicheService[];
  testimonials: NicheTestimonial[];
  /** Paragraphe à-propos (1ère lettre = drop-cap). Placeholders {ville} / {name}. */
  aboutText: string;
  ticker: string[];
  /** Ce que la maquette vend en bas de page. */
  offer: OfferKind;
  /** Nom du module de réservation dans la langue du métier ("l'agenda", "le carnet"). */
  bookingWord: string;
  labels: {
    catalogue: string; // titre prestations (ligne 1)
    catalogueSub: string; // titre prestations (ligne 2, italique)
    catalogueNote: string;
    gallery: string; // titre galerie (ligne 1)
    gallerySub: string; // titre galerie (ligne 2, italique)
    cta: string; // libellé bouton RDV
    ctaFinal: string; // verbe du gros CTA final ("réserver")
    serviceUnit: string; // libellé colonne durée ("Durée") — ignoré si pas de duration
  };
}

const u = (id: string, w = 1100) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const DEFAULT_LABELS: NicheKit["labels"] = {
  catalogue: "Le catalogue",
  catalogueSub: "complet",
  catalogueNote: "Tarifs et durées indicatifs. Réservation au salon ou par téléphone.",
  gallery: "Le travail",
  gallerySub: "en images",
  cta: "Prendre rendez-vous",
  ctaFinal: "réserver",
  serviceUnit: "Durée",
};

const COIFFURE: NicheKit = {
  accent: "#7A4257",
  accentDark: "#5C2F3F",
  hero: u("1560066984-138dadb4c035", 1000),
  about: u("1562322140-8baeececf3df", 1000),
  gallery: [
    u("1521590832167-7bcbfaa6381f", 700),
    u("1503951914875-452162b0f3f1", 700),
    u("1599351431202-1e0f0137899a", 700),
    u("1633681926035-ec1ac984418a", 700),
    u("1580618672591-eb180b1a973f", 700),
    u("1595476108010-b4d1f102b1b1", 700),
  ],
  services: [
    { name: "Coupe & Brushing", desc: "Diagnostic, shampoing-soin, coupe sur-mesure et brushing finition.", duration: 45, price: 39, cat: "Coiffure" },
    { name: "Coupe homme", desc: "Coupe ciseaux ou tondeuse, contours nets et coiffage.", duration: 30, price: 25, cat: "Coiffure" },
    { name: "Coloration", desc: "Couleur d'oxydation ou ton sur ton, racines et longueurs.", duration: 90, price: 65, cat: "Couleur" },
    { name: "Balayage / Mèches", desc: "Éclaircissement progressif, effet naturel, patine incluse.", duration: 120, price: 95, cat: "Couleur" },
    { name: "Soin profond", desc: "Masque réparateur, massage du cuir chevelu, brillance.", duration: 30, price: 29, cat: "Soin" },
    { name: "Coiffure événement", desc: "Chignon, attache ou coiffure de mariage. Essai sur RDV.", duration: 60, price: 80, cat: "Événement" },
  ],
  testimonials: [
    { author: "Camille R.", rating: 5, comment: "Accueil parfait, ma coloration n'a jamais aussi bien tenu. Je ne change plus de salon !", date: "mars 2024" },
    { author: "Lucie M.", rating: 5, comment: "Exactement la coupe que je voulais, conseils au top. Un vrai moment pour soi.", date: "février 2024" },
    { author: "Isabelle T.", rating: 4, comment: "Équipe adorable et résultat impeccable. Petit délai d'attente mais ça vaut le coup.", date: "janvier 2024" },
  ],
  aboutText:
    "Au cœur de {ville}, {name} cultive l'art de la coiffure depuis des années. Coupes sur-mesure, colorations soignées et soins d'exception, dans un écrin chaleureux où chaque visite devient un moment pour soi.",
  ticker: ["Sur rendez-vous", "Coloriste expert", "Produits premium", "Coupe & couleur"],
  offer: "booking",
  bookingWord: "l'agenda",
  labels: DEFAULT_LABELS,
};

const BARBIER: NicheKit = {
  accent: "#C08A3E",
  accentDark: "#9A6B28",
  hero: u("1585747860715-2ba37e788b70", 1000),
  about: u("1622287162716-f311baa1a2b8", 1000),
  gallery: [
    u("1503951914875-452162b0f3f1", 700),
    u("1605497788044-5a32c7078486", 700),
    u("1596728325488-58c87691e9af", 700),
    u("1516975080664-ed2fc6a32937", 700),
    u("1493256338651-d82f7acb2b38", 700),
    u("1599351431202-1e0f0137899a", 700),
  ],
  services: [
    { name: "Coupe classique", desc: "Ciseaux ou tondeuse, contours à la lame, coiffage.", duration: 30, price: 25, cat: "Coupe" },
    { name: "Coupe + barbe", desc: "Le combo maison : coupe complète et barbe retravaillée.", duration: 45, price: 38, cat: "Coupe" },
    { name: "Rasage traditionnel", desc: "Serviette chaude, blaireau, coupe-chou, baume apaisant.", duration: 30, price: 24, cat: "Barbe" },
    { name: "Taille de barbe", desc: "Mise en forme, dégradé des joues, huile de finition.", duration: 20, price: 18, cat: "Barbe" },
    { name: "Coupe enfant", desc: "Moins de 12 ans, on prend le temps qu'il faut.", duration: 25, price: 17, cat: "Coupe" },
    { name: "Forfait père & fils", desc: "Deux coupes à la suite, un seul créneau à bloquer.", duration: 55, price: 38, cat: "Forfait" },
  ],
  testimonials: [
    { author: "Kevin D.", rating: 5, comment: "Le dégradé est net, la barbe impeccable. Enfin un barbier qui écoute.", date: "mars 2024" },
    { author: "Sofiane B.", rating: 5, comment: "Rasage à l'ancienne, serviette chaude, on ressort neuf. Rien à dire.", date: "février 2024" },
    { author: "Antoine L.", rating: 5, comment: "Je réserve en ligne le matin pour le soir, jamais d'attente. Parfait.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} tient la boutique comme on tient une lame : droit. Coupe précise, barbe travaillée, serviette chaude et conversation si vous voulez — le fauteuil est à vous le temps qu'il faut.",
  ticker: ["Coupe & barbe", "Rasage à l'ancienne", "Sans attente", "Réservation en ligne"],
  offer: "booking",
  bookingWord: "le carnet",
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "La carte",
    catalogueSub: "du barbier",
    catalogueNote: "Tarifs fermes, durées réelles. Réservez votre fauteuil en ligne.",
    gallery: "Le travail",
    gallerySub: "au fauteuil",
    cta: "Réserver un fauteuil",
    ctaFinal: "passer",
  },
};

const ESTHETIQUE: NicheKit = {
  accent: "#7E9478",
  accentDark: "#5D7157",
  hero: u("1570172619644-dfd03ed5d881", 1000),
  about: u("1512290923902-8a9f81dc236c", 1000),
  gallery: [
    u("1556228720-195a672e8a03", 700),
    u("1522337660859-02fbefca4702", 700),
    u("1604654894610-df63bc536371", 700),
    u("1519014816548-bf5fe059798b", 700),
    u("1571781926291-c477ebfd024b", 700),
    u("1481833761820-0509d3217039", 700),
  ],
  services: [
    { name: "Soin du visage", desc: "Nettoyage, gommage et masque adaptés à votre peau.", duration: 60, price: 55, cat: "Visage" },
    { name: "Épilation", desc: "À la cire tiède, zones au choix, en douceur.", duration: 30, price: 25, cat: "Épilation" },
    { name: "Manucure", desc: "Pose vernis ou semi-permanent, ongles soignés.", duration: 45, price: 35, cat: "Ongles" },
    { name: "Pose de cils", desc: "Extensions cil à cil ou volume russe, regard intense.", duration: 90, price: 75, cat: "Regard" },
    { name: "Modelage corps", desc: "Massage relaxant aux huiles, détente garantie.", duration: 60, price: 60, cat: "Bien-être" },
    { name: "Forfait beauté", desc: "Visage + mains + pieds, un moment cocooning complet.", duration: 120, price: 110, cat: "Forfait" },
  ],
  testimonials: [
    { author: "Léa M.", rating: 5, comment: "Un vrai moment de détente, peau sublimée et conseils précieux.", date: "mars 2024" },
    { author: "Nadia K.", rating: 5, comment: "Mains de fée et institut très propre. Je recommande à 100%.", date: "février 2024" },
    { author: "Chloé P.", rating: 4, comment: "Super accueil, résultat impeccable sur la pose de cils.", date: "janvier 2024" },
  ],
  aboutText:
    "Au cœur de {ville}, {name} prend soin de vous dans un cocon dédié à la beauté et au bien-être. Des soins sur-mesure, des produits choisis avec soin, et l'envie de vous faire rayonner.",
  ticker: ["Sur rendez-vous", "Soins sur-mesure", "Produits choisis", "Cabine privée"],
  offer: "booking",
  bookingWord: "la cabine",
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les soins",
    catalogueSub: "à la carte",
    catalogueNote: "Durées réelles en cabine. Réservez votre créneau en ligne, à toute heure.",
    gallery: "Notre",
    gallerySub: "univers",
    cta: "Réserver un soin",
    ctaFinal: "prendre",
  },
};

const ONGLERIE: NicheKit = {
  accent: "#E8467C",
  accentDark: "#B92F60",
  hero: u("1604654894610-df63bc536371", 1000),
  about: u("1610992015732-2449b76344bc", 1000),
  gallery: [
    u("1632345031435-8727f6897d53", 700),
    u("1519014816548-bf5fe059798b", 700),
    u("1571781926291-c477ebfd024b", 700),
    u("1556228720-195a672e8a03", 700),
    u("1522337660859-02fbefca4702", 700),
    u("1481833761820-0509d3217039", 700),
  ],
  services: [
    { name: "Semi-permanent", desc: "Pose couleur tenue 3 semaines, finition brillante.", duration: 60, price: 35, cat: "Pose" },
    { name: "Gel / Résine", desc: "Rallongement au chablon, forme et longueur au choix.", duration: 90, price: 55, cat: "Pose" },
    { name: "Remplissage", desc: "Retouche des repousses, on repart comme au premier jour.", duration: 75, price: 45, cat: "Entretien" },
    { name: "Nail art", desc: "French, chrome, strass ou dessin — tarif par ongle.", duration: 15, price: 5, cat: "Déco" },
    { name: "Beauté des mains", desc: "Gommage, cuticules, massage et vernis.", duration: 45, price: 30, cat: "Soin" },
    { name: "Dépose + soin", desc: "Dépose douce, ongles remis en forme et nourris.", duration: 30, price: 20, cat: "Soin" },
  ],
  testimonials: [
    { author: "Inès B.", rating: 5, comment: "Mes ongles tiennent 4 semaines sans bouger. Le nail art est dingue.", date: "mars 2024" },
    { author: "Sarah G.", rating: 5, comment: "Je réserve depuis mon téléphone le soir, créneau confirmé direct. Trop pratique.", date: "février 2024" },
    { author: "Maëva C.", rating: 5, comment: "Toujours de nouvelles idées et un résultat impeccable. Ma pause à moi.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} fait des ongles un terrain de jeu. Pose nette, tenue longue, couleurs qu'on ne voit pas partout — et le temps de choisir ce qui vous ressemble vraiment.",
  ticker: ["Pose longue tenue", "Nail art sur-mesure", "Réservation en ligne", "Hygiène stricte"],
  offer: "booking",
  bookingWord: "le créneau",
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "La carte",
    catalogueSub: "des poses",
    catalogueNote: "Tarifs par prestation. Le nail art est facturé à l'ongle.",
    gallery: "Les",
    gallerySub: "réalisations",
    cta: "Réserver ma pose",
    ctaFinal: "réserver",
  },
};

const RESTAURANT: NicheKit = {
  accent: "#D98E2B",
  accentDark: "#A96A17",
  hero: u("1517248135467-4c7edcad34c4", 1000),
  about: u("1414235077428-338989a2e8c0", 1000),
  gallery: [
    u("1424847651672-bf20a4b0982b", 700),
    u("1600891964092-4316c288032e", 700),
    u("1565299624946-b28f40a0ae38", 700),
    u("1504674900247-0877df9cc836", 700),
    u("1546069901-ba9599a7e63c", 700),
    u("1552566626-52f8b828add9", 700),
  ],
  services: [
    { name: "Entrée du moment", desc: "Produits de saison, préparés maison chaque jour.", price: 9, cat: "Entrée" },
    { name: "Plat signature", desc: "La spécialité de la maison, généreuse et savoureuse.", price: 19, cat: "Plat" },
    { name: "Plat du jour", desc: "Ardoise renouvelée quotidiennement selon le marché.", price: 15, cat: "Plat" },
    { name: "Dessert maison", desc: "Pâtisserie fraîche, gourmande et faite sur place.", price: 8, cat: "Dessert" },
    { name: "Menu midi", desc: "Entrée + plat + dessert, formule rapide du déjeuner.", price: 22, cat: "Formule" },
    { name: "Menu dégustation", desc: "Plusieurs services pour découvrir toute la carte.", price: 45, cat: "Formule" },
  ],
  testimonials: [
    { author: "Thomas B.", rating: 5, comment: "Cuisine savoureuse et produits frais. On reviendra, c'est sûr !", date: "mars 2024" },
    { author: "Sophie L.", rating: 5, comment: "Accueil chaleureux, assiettes généreuses. Une vraie adresse.", date: "février 2024" },
    { author: "Marc D.", rating: 4, comment: "Très bon rapport qualité/prix le midi. Pensez à réserver.", date: "janvier 2024" },
  ],
  aboutText:
    "Au cœur de {ville}, {name} fait rimer cuisine de saison et accueil chaleureux. Des produits frais, une carte qui évolue au fil du marché, et l'envie de vous régaler à chaque service.",
  ticker: ["Cuisine maison", "Produits frais", "Table réservable en ligne", "Carte de saison"],
  offer: "booking",
  bookingWord: "le plan de salle",
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "La carte",
    catalogueSub: "du moment",
    catalogueNote: "Carte indicative qui évolue selon le marché. Réservation conseillée.",
    gallery: "Nos",
    gallerySub: "assiettes",
    cta: "Réserver une table",
    ctaFinal: "réserver",
    serviceUnit: "",
  },
};

const FLEURISTE: NicheKit = {
  accent: "#4B6B4F",
  accentDark: "#33503A",
  hero: u("1487070183336-b863922373d4", 1000),
  about: u("1490750967868-88aa4486c946", 1000),
  gallery: [
    u("1465146344425-f00d5f5c8f07", 700),
    u("1508610048659-a06b669e3321", 700),
    u("1526047932273-341f2a7631f9", 700),
    u("1567696153410-7ae55f32e4dc", 700),
    u("1533616688419-b7a585564566", 700),
    u("1563241527-3004b7be0ffd", 700),
  ],
  services: [
    { name: "Bouquet du fleuriste", desc: "Carte blanche selon l'arrivage du matin.", price: 25, from: true, cat: "Bouquet" },
    { name: "Composition de saison", desc: "En coupe ou en vase, montée à la main.", price: 35, from: true, cat: "Composition" },
    { name: "Plante d'intérieur", desc: "Choisie avec vous selon la lumière de la pièce.", price: 20, from: true, cat: "Plante" },
    { name: "Abonnement bureau", desc: "Un bouquet frais livré chaque semaine.", price: 45, cat: "Abonnement" },
    { name: "Deuil & cérémonie", desc: "Coussin, raquette ou gerbe, livrés à l'heure dite.", price: 90, from: true, cat: "Cérémonie" },
    { name: "Mariage", desc: "Bouquet de mariée, boutonnières et décor de table.", price: 250, from: true, cat: "Événement" },
  ],
  testimonials: [
    { author: "Hélène F.", rating: 5, comment: "Un bouquet monté devant moi, tenu presque deux semaines. Du vrai métier.", date: "mars 2024" },
    { author: "Julien P.", rating: 5, comment: "Commande passée le matin, livrée l'après-midi pour un anniversaire. Sauvé.", date: "février 2024" },
    { author: "Martine D.", rating: 5, comment: "Pour une cérémonie difficile, beaucoup de tact et des fleurs magnifiques.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} ouvre avant tout le monde pour choisir les fleurs une par une. Bouquets montés à la main, plantes conseillées selon votre lumière, et le respect des saisons plutôt que le catalogue.",
  ticker: ["Arrivage quotidien", "Bouquets montés main", "Livraison locale", "Fleurs de saison"],
  offer: "vitrine",
  bookingWord: "la boutique",
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "L'atelier",
    catalogueSub: "et ses prix",
    catalogueNote: "Prix de départ indicatifs — chaque pièce est montée à la demande.",
    gallery: "Les",
    gallerySub: "compositions",
    cta: "Appeler la boutique",
    ctaFinal: "commander",
    serviceUnit: "",
  },
};

const TATOUEUR: NicheKit = {
  accent: "#C1272D",
  accentDark: "#941C21",
  hero: u("1611501275019-9b5cda994e8d", 1000),
  about: u("1565058379802-bbe93b2f703a", 1000),
  gallery: [
    u("1562962230-16e4623d36e6", 700),
    u("1597852075234-fd721ac361d3", 700),
    u("1608666599953-b951163495f4", 700),
    u("1598371839696-5c5bb00bdc28", 700),
    u("1650783756107-739513b38177", 700),
    u("1583213261205-63258746ed4c", 700),
  ],
  services: [
    { name: "Consultation projet", desc: "On parle placement, taille et style. Sans engagement.", duration: 30, price: 0, cat: "Projet" },
    { name: "Flash", desc: "Un dessin du flash sheet, posé dans la journée.", duration: 60, price: 80, from: true, cat: "Flash" },
    { name: "Pièce moyenne", desc: "Avant-bras, mollet, épaule — dessin sur-mesure.", duration: 180, price: 250, from: true, cat: "Custom" },
    { name: "Grande pièce", desc: "Manchette ou dos, au forfait séance.", duration: 300, price: 450, from: true, cat: "Custom" },
    { name: "Cover-up", desc: "Recouvrement d'un ancien tatouage, étudié au cas par cas.", duration: 240, price: 300, from: true, cat: "Custom" },
    { name: "Retouche", desc: "Reprise de contours ou de noirs, offerte sous 3 mois.", duration: 45, price: 50, cat: "Suivi" },
  ],
  testimonials: [
    { author: "Rémi V.", rating: 5, comment: "Le dessin proposé était mieux que ce que j'avais en tête. Trait net, cicatrisation nickel.", date: "mars 2024" },
    { author: "Océane M.", rating: 5, comment: "Studio impeccable, matériel sous blister, zéro question sans réponse.", date: "février 2024" },
    { author: "Bilal A.", rating: 5, comment: "Cover-up d'un vieux tatouage raté : on ne voit plus rien. Chapeau.", date: "janvier 2024" },
  ],
  aboutText:
    "À {ville}, {name} dessine avant de piquer. Chaque projet passe par une consultation, un dessin sur-mesure et un studio tenu au cordeau — matériel à usage unique, encres tracées, cicatrisation suivie.",
  ticker: ["Projet sur-mesure", "Studio déclaré ARS", "Matériel à usage unique", "Sur rendez-vous"],
  offer: "booking",
  bookingWord: "la séance",
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les",
    catalogueSub: "tarifs",
    catalogueNote: "Un devis ferme est donné après la consultation. Acompte à la réservation.",
    gallery: "Le",
    gallerySub: "book",
    cta: "Demander un projet",
    ctaFinal: "lancer",
    serviceUnit: "Séance",
  },
};

/** Clés de niche — une par direction artistique. */
export type NicheKey =
  | "coiffure"
  | "barbier"
  | "esthetique"
  | "onglerie"
  | "restaurant"
  | "fleuriste"
  | "tatoueur";

export const NICHE_KITS: Record<NicheKey, NicheKit> = {
  coiffure: COIFFURE,
  barbier: BARBIER,
  esthetique: ESTHETIQUE,
  onglerie: ONGLERIE,
  restaurant: RESTAURANT,
  fleuriste: FLEURISTE,
  tatoueur: TATOUEUR,
};

/**
 * Reconnaissance du métier → niche. L'ordre COMPTE : « barbier » doit être
 * testé avant « coiffeur » (un barbier est un coiffeur, l'inverse est faux), et
 * « onglerie » avant « esthétique » (une prothésiste ongulaire n'est pas une
 * esthéticienne, mais les libellés scrapés mélangent souvent les deux).
 */
const MATCHERS: Array<[RegExp, NicheKey]> = [
  [/(barbi|barber|barbe)/, "barbier"],
  [/(ongl|nail|manucur|podolog|capillair(?=.*ongl))/, "onglerie"],
  [/(tatou|tattoo|piercing|ink\b)/, "tatoueur"],
  [/(fleur|flori|floral|bouquet)/, "fleuriste"],
  [/(restau|resto|traiteur|pizz|brasserie|bistrot|burger|sushi|cuisine)/, "restaurant"],
  [/(coiff|hair|coloris|salon de coiffure)/, "coiffure"],
  [/(esth|institut|beaut|spa|cils|epilation|épilation|massage|onglerie)/, "esthetique"],
];

/**
 * Niche du métier, ou `null` si le métier n'en est pas une.
 *
 * Le null est essentiel : c'est lui qui empêche d'envoyer une page de salon de
 * coiffure à un serrurier au motif qu'il faut bien choisir quelque chose.
 */
export function matchNiche(metier?: string | null): NicheKey | null {
  const m = (metier ?? "").toLowerCase().trim();
  if (!m) return null;
  for (const [re, key] of MATCHERS) if (re.test(m)) return key;
  return (NICHE_KITS as Record<string, NicheKit>)[m] ? (m as NicheKey) : null;
}

/** Niche du métier (alias inclus), sinon la coiffure — la niche la plus servie. */
export function nicheForMetier(metier?: string | null): NicheKey {
  return matchNiche(metier) ?? "coiffure";
}

/** Renvoie le kit du métier (alias inclus), sinon le kit par défaut (coiffure). */
export function kitForMetier(metier?: string | null): NicheKit {
  return NICHE_KITS[nicheForMetier(metier)];
}
