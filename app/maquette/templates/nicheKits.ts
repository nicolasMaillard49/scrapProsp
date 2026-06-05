// Kits de contenu par niche pour le template éditorial "Salon" (SalonTemplate).
// Permet de servir un aperçu cohérent aux prospects Instagram de niches variées
// (coiffure, restauration, beauté…) avec le même layout, en changeant images,
// prestations, témoignages, couleur d'accent et libellés.
// Images : IDs Unsplash vérifiés (HTTP 200). {ville}/{name} = placeholders.

export interface NicheService {
  name: string;
  desc: string;
  price: number;
  cat: string;
  duration?: number; // min — omis pour les niches où ça n'a pas de sens (resto)
}
export interface NicheTestimonial {
  author: string;
  rating: number;
  comment: string;
  date: string;
}
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
  accent: "#C34A2C",
  accentDark: "#A53C22",
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
  labels: DEFAULT_LABELS,
};

const RESTAURANT: NicheKit = {
  accent: "#B23A2E",
  accentDark: "#8E2C22",
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
  ticker: ["Cuisine maison", "Produits frais", "Sur réservation", "Carte de saison"],
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

const ESTHETIQUE: NicheKit = {
  accent: "#B0708A",
  accentDark: "#915A70",
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
    { name: "Soin du visage", desc: "Nettoyage, gommage et masque adaptés à ta peau.", duration: 60, price: 55, cat: "Visage" },
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
  ticker: ["Sur rendez-vous", "Soins sur-mesure", "Produits choisis", "Détente & beauté"],
  labels: {
    ...DEFAULT_LABELS,
    catalogue: "Les soins",
    catalogueSub: "à la carte",
    gallery: "Notre",
    gallerySub: "univers",
  },
};

export const NICHE_KITS: Record<string, NicheKit> = {
  coiffeur: COIFFURE,
  restaurant: RESTAURANT,
  estheticienne: ESTHETIQUE,
  default: COIFFURE,
};

/** Renvoie le kit du métier (alias inclus), sinon le kit par défaut (coiffure). */
export function kitForMetier(metier?: string | null): NicheKit {
  const m = (metier ?? "").toLowerCase().trim();
  if (!m) return NICHE_KITS.default;
  if (/(coiff|barbi|barber|hair|coloris)/.test(m)) return COIFFURE;
  if (/(restau|resto|traiteur|pizz|brasserie|bistrot)/.test(m)) return RESTAURANT;
  if (/(esth|institut|beaut|ongl|nail|spa|cils)/.test(m)) return ESTHETIQUE;
  return NICHE_KITS[m] ?? NICHE_KITS.default;
}
