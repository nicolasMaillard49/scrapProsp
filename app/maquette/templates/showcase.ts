// Catalogue des maquettes — ce qu'on peut montrer à un prospect, métier par métier.
//
// Sert deux choses :
//   - /maquette/galerie : la planche de contact interne (toutes les maquettes
//     côte à côte, avec l'offre et le prix que chacune annonce) ;
//   - /maquette/apercu/[template] : le rendu plein écran d'une maquette avec un
//     prospect fictif, sans base de données.
//
// Le prospect de démo n'est PAS décoratif : il fixe le métier, donc le contenu
// (SERVICES / NICHE_KITS) réellement affiché. Changer `demo.metier` change ce
// que la maquette raconte.

import {
  ARTISAN_TEMPLATE,
  NICHE_TEMPLATE,
  SANTE_TEMPLATE,
  TEMPLATE_LABELS,
  type TemplateKey,
} from "@/app/lib/demoTemplate";
import { metierLabel, type TemplateProps } from "./data";
import { NICHE_KITS, type NicheKey } from "./nicheKits";
import { SANTE_KITS, SANTE_LABELS, type SanteKey } from "./santeKits";
import { OFFER_PRICE } from "./niches/shared";

export type Family = "niche" | "artisan" | "sante" | "editorial";

export interface ShowcaseEntry {
  key: TemplateKey;
  /** Libellé du sélecteur (source unique : TEMPLATE_LABELS). */
  label: string;
  family: Family;
  /** Nom de la direction artistique. */
  da: string;
  /** Ce que la page met en avant — l'argument de vente de CETTE maquette. */
  pitch: string;
  /** Palette dominante, en clair. */
  palette: string;
  /** Métiers routés vers cette maquette par templateForMetier(). */
  metiers: string[];
  /** Libellés scrapés qui tombent aussi ici (regex de matchNiche). */
  aliases: string | null;
  /** Prix HT annoncé en bas de maquette. null = dépend du métier affiché. */
  price: number | null;
  offer: "booking" | "vitrine" | "variable";
  /** false = la page récite le contenu d'un autre métier. */
  ownContent: boolean;
  demo: TemplateProps;
}

const NICHE_LABELS: Record<NicheKey, string> = {
  coiffure: "Coiffeur",
  barbier: "Barbier",
  esthetique: "Esthéticienne",
  onglerie: "Onglerie",
  restaurant: "Restaurant",
  fleuriste: "Fleuriste",
  tatoueur: "Tatoueur",
};

/** Métiers (labels) qui atterrissent sur cette maquette. */
function metiersFor(key: TemplateKey): string[] {
  const niches = (Object.entries(NICHE_TEMPLATE) as [NicheKey, TemplateKey][])
    .filter(([, v]) => v === key)
    .map(([n]) => NICHE_LABELS[n]);
  const santes = (Object.entries(SANTE_TEMPLATE) as [SanteKey, TemplateKey][])
    .filter(([, v]) => v === key)
    .map(([n]) => SANTE_LABELS[n]);
  const artisans = Object.entries(ARTISAN_TEMPLATE)
    .filter(([, v]) => v === key)
    .map(([m]) => metierLabel(m));
  // `maçon` et `macon` visent la même maquette : deux entrées de routage, un
  // seul métier à afficher.
  return [...new Set([...niches, ...santes, ...artisans])];
}

interface Seed {
  key: TemplateKey;
  family: Family;
  niche?: NicheKey;
  sante?: SanteKey;
  da: string;
  pitch: string;
  palette: string;
  aliases?: string;
  demo: TemplateProps;
}

const p = (
  name: string,
  metier: string,
  ville: string,
  phone: string,
  rating: number,
  reviews: number,
  address: string,
): TemplateProps => ({ name, metier, ville, phone, rating, reviews, address });

const SEEDS: Seed[] = [
  /* ── Niches Instagram : une direction artistique par métier ── */
  {
    key: "coiffeur",
    family: "niche",
    niche: "coiffure",
    da: "Le miroir",
    pitch: "Module de réservation posé DANS le hero — le créneau se voit avant le premier scroll.",
    palette: "Greige chaud + prune, empattements fins",
    aliases: "coiff, hair, coloriste, salon de coiffure",
    demo: p("Studio Élise", "coiffeur", "Angers", "02 41 88 12 45", 4.8, 127, "12 rue Saint-Laud, 49100 Angers"),
  },
  {
    key: "barbier",
    family: "niche",
    niche: "barbier",
    da: "Atelier",
    pitch: "Le prochain fauteuil libre affiché en clair, carte à tarifs fermes.",
    palette: "Noir + laiton, condensée capitale",
    aliases: "barbier, barber, barbe",
    demo: p("Le Comptoir du Barbier", "barbier", "Nantes", "02 40 35 76 22", 4.9, 214, "8 rue Crébillon, 44000 Nantes"),
  },
  {
    key: "institut",
    family: "niche",
    niche: "esthetique",
    da: "Cabine",
    pitch: "Cadran de durée par soin — on achète un temps en cabine, pas une ligne de tarif.",
    palette: "Sauge, angles arrondis",
    aliases: "esthé, institut, beauté, spa, cils, épilation, massage",
    demo: p("Institut Nélya", "esthéticienne", "Tours", "02 47 61 09 88", 4.9, 96, "24 rue Nationale, 37000 Tours"),
  },
  {
    key: "onglerie",
    family: "niche",
    niche: "onglerie",
    da: "Studio pop",
    pitch: "Composeur forme + couleur : la cliente construit sa pose avant d'appeler.",
    palette: "Dégradé rose / violet",
    aliases: "ongl, nail, manucure, podologue",
    demo: p("Bella Nails", "onglerie", "Le Mans", "02 43 24 51 07", 4.7, 183, "5 place de la République, 72000 Le Mans"),
  },
  {
    key: "restaurant",
    family: "niche",
    niche: "restaurant",
    da: "Salle du soir",
    pitch: "Réservation couverts / service / heure, carte à pointillés comme une ardoise.",
    palette: "Didone, ambre sur nuit",
    aliases: "restau, resto, traiteur, pizzeria, brasserie, bistrot, burger, sushi",
    demo: p("La Table de Marius", "restaurant", "Saumur", "02 41 51 33 90", 4.6, 342, "3 quai Mayaud, 49400 Saumur"),
  },
  {
    key: "fleuriste",
    family: "niche",
    niche: "fleuriste",
    da: "Saisons",
    pitch: "Calendrier de floraison du mois. Seule niche sans créneau : elle reste en vitrine.",
    palette: "Vert profond",
    aliases: "fleur, floral, bouquet",
    demo: p("Au Jardin d'Alice", "fleuriste", "Cholet", "02 41 62 18 74", 4.9, 88, "17 rue Nationale, 49300 Cholet"),
  },
  {
    key: "tatoueur",
    family: "niche",
    niche: "tatoueur",
    da: "Flash",
    pitch: "Demande de projet zone / taille / style — la consultation avant le devis.",
    palette: "Os + rouge sang",
    aliases: "tatouage, tattoo, piercing, ink",
    demo: p("Encre Noire", "tatoueur", "Rennes", "02 99 78 40 15", 5.0, 156, "9 rue Saint-Michel, 35000 Rennes"),
  },

  /* ── Artisans : une DA par métier, comme les niches ── */
  {
    key: "plombier",
    family: "artisan",
    da: "L'urgence",
    pitch: "Tarificateur dans le hero : on clique sur sa panne, on lit le prix avant d'appeler.",
    palette: "Ardoise + bleu, Archivo Black",
    aliases: "plomberie, sanitaire, salle de bain, débouchage",
    demo: p("Dupont Plomberie", "plombier", "Angers", "02 41 87 65 30", 4.7, 112, "6 rue Bressigny, 49100 Angers"),
  },
  {
    key: "serrurier",
    family: "artisan",
    da: "L'urgence",
    pitch: "Même mécanique, registre anti-arnaque : prix annoncé au téléphone, délai de 25 min.",
    palette: "Ardoise + orange sécurité",
    aliases: "serrurerie, ferronnier, métallier, portail, blindage",
    demo: p("Clé Express", "serrurier", "Le Mans", "02 43 87 14 02", 4.5, 143, "14 av. du Général de Gaulle, 72000 Le Mans"),
  },
  {
    key: "electricien",
    family: "artisan",
    da: "Le tableau",
    pitch: "Les 6 points de la NF C 15-100 en rapport de contrôle, avec un tableau dessiné en SVG.",
    palette: "Noir atelier + jaune sécurité, mono",
    aliases: "électricité, domotique, mise aux normes",
    demo: p("Volt & Fils", "electricien", "Angers", "02 41 43 90 21", 4.8, 74, "31 bd Foch, 49000 Angers"),
  },
  {
    key: "couvreur",
    family: "artisan",
    da: "Le chantier",
    pitch: "Les 5 signes qui doivent faire appeler, puis les 4 étapes datées du chantier.",
    palette: "Béton clair + tuile, Oswald condensé",
    aliases: "couverture, toiture, zinguerie, charpentier, ardoise",
    demo: p("Toitures de l'Ouest", "couvreur", "Laval", "02 43 49 08 37", 4.7, 67, "21 rue du Pont de Mayenne, 53000 Laval"),
  },
  {
    key: "macon",
    family: "artisan",
    da: "Le chantier",
    pitch: "Même dossier de chantier, contenu gros œuvre : fissures, ouvertures, planning.",
    palette: "Béton clair + pierre",
    aliases: "maçonnerie, gros œuvre, terrassement, ravalement",
    demo: p("Bâti Loire", "maçon", "Saumur", "02 41 50 77 12", 4.8, 58, "9 rue du Portail Louis, 49400 Saumur"),
  },
  {
    key: "chauffagiste",
    family: "artisan",
    da: "La chaudière",
    pitch: "Facture annuelle avant/après en barres, puis les aides déduites du devis.",
    palette: "Bleu nuit qui vire à la flamme",
    aliases: "chauffage, pompe à chaleur, PAC, climatisation, chaudière",
    demo: p("Thermic Ouest", "chauffagiste", "Nantes", "02 40 12 77 45", 4.6, 89, "44 rue de Rennes, 44000 Nantes"),
  },
  {
    key: "menuisier",
    family: "artisan",
    da: "L'établi",
    pitch: "Nuancier d'essences : on choisit le bois avant le meuble. Contre l'enseigne de cuisines.",
    palette: "Papier chaud + bois, Fraunces",
    aliases: "menuiserie, ébéniste, agencement, cuisiniste, escalier, parquet",
    demo: p("Atelier Bois & Cie", "menuisier", "Tours", "02 47 20 63 91", 4.9, 52, "8 rue Colbert, 37000 Tours"),
  },
  {
    key: "carreleur",
    family: "artisan",
    da: "La surface",
    pitch: "Estimateur au m² par pièce type — la réponse au « ça coûte combien chez moi ».",
    palette: "Blanc de chantier + vert-bleu",
    aliases: "carrelage, faïence, mosaïque, chape",
    demo: p("Carrelage Loire", "carreleur", "Angers", "02 41 34 88 05", 4.8, 71, "18 rue Chevreul, 49100 Angers"),
  },
  {
    key: "peintre",
    family: "artisan",
    da: "La surface",
    pitch: "Même estimateur, nuancier de teintes à la place des motifs de pose.",
    palette: "Blanc de chantier + bleu",
    aliases: "peinture, plaquiste, plâtrier, placo, enduit",
    demo: p("Couleurs & Cie", "peintre", "Nantes", "02 40 89 21 66", 4.7, 94, "7 rue du Calvaire, 44000 Nantes"),
  },
  {
    key: "paysagiste",
    family: "artisan",
    da: "Le jardin",
    pitch: "Calendrier des 4 saisons : ce qui transforme un devis ponctuel en contrat annuel.",
    palette: "Crème + vert profond, Newsreader",
    aliases: "paysagiste, jardinier, élagage, espaces verts",
    demo: p("Vert Horizon", "paysagiste", "Cholet", "02 41 56 22 68", 4.9, 61, "2 rue des Tilleuls, 49300 Cholet"),
  },

  /* ── Professions libérales : aucune n'affiche d'avis ── */
  {
    key: "dentiste",
    family: "sante",
    sante: "dentiste",
    da: "Le plan de traitement",
    pitch: "Le devis en trois colonnes — honoraires, Sécu, reste à charge — et l'agenda dans le hero.",
    palette: "Blanc clinique + bleu froid",
    aliases: "dentaire, orthodontiste, implantologie, stomatologie",
    demo: p("Cabinet dentaire du Centre", "dentiste", "Angers", "02 41 25 60 18", 4.7, 96, "3 place du Ralliement, 49100 Angers"),
  },
  {
    key: "kine",
    family: "sante",
    sante: "kine",
    da: "Le protocole",
    pitch: "Les 4 phases de rééducation avec leurs durées — ce qui fait comprendre pourquoi il faut 20 séances.",
    palette: "Vert clinique + condensée capitale",
    aliases: "kinésithérapeute, masseur-kiné, rééducation",
    demo: p("Cabinet de kinésithérapie Saint-Serge", "kine", "Angers", "02 41 72 30 55", 4.8, 64, "7 rue Saint-Serge, 49100 Angers"),
  },
  {
    key: "medecin",
    family: "sante",
    sante: "medecin",
    da: "Le cabinet",
    pitch: "Fiche d'informations pratiques + bandeau d'urgence (15 / 116 117). Registre institutionnel, zéro publicité.",
    palette: "Blanc + bleu institutionnel, sérif de labeur",
    aliases: "médecin généraliste, cabinet médical, maison de santé",
    demo: p("Cabinet médical des Halles", "medecin", "Nantes", "02 40 47 82 10", 4.6, 51, "12 rue de la Marne, 44000 Nantes"),
  },

  {
    key: "osteopathe",
    family: "sante",
    sante: "osteopathe",
    da: "La planche",
    pitch: "Silhouette anatomique à la craie : les 4 zones examinées, pour dire que le motif ne borne pas l'examen.",
    palette: "Indigo profond + cuivre, Spectral",
    aliases: "ostéopathe, ostéo",
    demo: p("Cabinet d'ostéopathie Bressigny", "osteopathe", "Angers", "02 41 20 44 71", 4.9, 88, "22 rue Bressigny, 49100 Angers"),
  },
  {
    key: "podologue",
    family: "sante",
    sante: "podologue",
    da: "L'appui",
    pitch: "Carte de pression plantaire en SVG — l'argument opposable aux semelles vendues en rayon.",
    palette: "Gris instrument + rouge d'appui, Chivo",
    aliases: "pédicure-podologue, podologie, posturologie",
    demo: p("Cabinet de podologie du Mail", "podologue", "Angers", "02 41 87 39 62", 4.8, 57, "5 bd du Roi René, 49100 Angers"),
  },

  {
    key: "orthophoniste",
    family: "sante",
    sante: "orthophoniste",
    da: "La bulle",
    pitch: "Quatre bulles de parole, une par tranche d'âge — la page trie les demandes à la place du praticien.",
    palette: "Crème chaud + corail, Gloock",
    aliases: "orthophonie, orthoptiste",
    demo: p("Cabinet d'orthophonie des Lices", "orthophoniste", "Angers", "02 41 88 05 27", 4.9, 43, "11 rue des Lices, 49100 Angers"),
  },

  {
    key: "sagefemme",
    family: "sante",
    sante: "sagefemme",
    da: "La frise",
    pitch: "Le suivi tracé sur une ligne de vie, du 1er mois au retour à la maison — et la prévention hors grossesse.",
    palette: "Rose sourd + sauge, Petrona",
    aliases: "sage-femme, maïeutique, périnatalité",
    demo: p("Cabinet de sages-femmes du Pont", "sagefemme", "Nantes", "02 40 73 21 08", 4.9, 62, "4 rue Kervégan, 44000 Nantes"),
  },
  {
    key: "veterinaire",
    family: "sante",
    sante: "veterinaire",
    da: "Le carnet",
    pitch: "Le carnet de vaccination avec ses rythmes, bandeau d'astreinte en tête, devis avant chirurgie.",
    palette: "Kraft + ocre, Zilla Slab",
    aliases: "vétérinaire, clinique vétérinaire",
    demo: p("Clinique vétérinaire des Ponts", "veterinaire", "Angers", "02 41 66 30 44", 4.8, 187, "40 rue Chevreul, 49100 Angers"),
  },
  {
    key: "psychologue",
    family: "sante",
    sante: "psychologue",
    da: "Le cadre",
    pitch: "Un cadran de 50 minutes et les 4 temps de la première séance. La page entière est encadrée d'un filet.",
    palette: "Grège froid + bleu ardoise, Literata",
    aliases: "psychologue, psychothérapeute, neuropsychologue",
    demo: p("Cabinet de psychologie Saint-Aubin", "psychologue", "Angers", "02 41 05 77 19", 4.9, 38, "16 rue Saint-Aubin, 49100 Angers"),
  },
  {
    key: "dieteticien",
    family: "sante",
    sante: "dieteticien",
    da: "L'assiette",
    pitch: "L'assiette en proportions réelles, et surtout la liste de ce que ce n'est PAS — l'arme anti-coach Instagram.",
    palette: "Crème + vert frais, Bricolage Grotesque",
    aliases: "diététicien, nutritionniste, micronutrition",
    demo: p("Cabinet de diététique du Mail", "dieteticien", "Le Mans", "02 43 28 66 40", 4.8, 54, "9 av. de Paderborn, 72000 Le Mans"),
  },
  {
    key: "sophrologue",
    family: "sante",
    sante: "sophrologue",
    da: "Le souffle",
    pitch: "Une courbe de respiration traverse le hero, la séance se lit minute par minute dessous.",
    palette: "Brume + bleu lavande, Epilogue",
    aliases: "sophrologue, hypnothérapeute, naturopathe",
    demo: p("Espace sophrologie La Doutre", "sophrologue", "Angers", "02 41 24 90 55", 4.9, 41, "3 rue Beaurepaire, 49100 Angers"),
  },
  {
    key: "avocat",
    family: "sante",
    sante: "avocat",
    da: "Le dossier",
    pitch: "Domaines en onglets de chemise cartonnée, et les 3 modes d'honoraires expliqués — dont la limite légale du résultat.",
    palette: "Bleu nuit + laiton, Frank Ruhl Libre",
    aliases: "avocat, barreau, droit du travail, droit de la famille",
    demo: p("Cabinet Lemoine & Associés", "avocat", "Nantes", "02 40 12 55 80", 4.8, 29, "6 place Royale, 44000 Nantes"),
  },
  {
    key: "notaire",
    family: "sante",
    sante: "notaire",
    da: "L'acte",
    pitch: "Sceau dessiné en SVG, délai et pièces pour chaque acte, et la vérité sur les « frais de notaire ».",
    palette: "Ivoire + bordeaux, capitales romaines",
    aliases: "notaire, étude notariale",
    demo: p("Étude notariale du Ralliement", "notaire", "Angers", "02 41 87 44 10", 4.7, 34, "2 place du Ralliement, 49100 Angers"),
  },
  {
    key: "expertcomptable",
    family: "sante",
    sante: "expertcomptable",
    da: "Le grand livre",
    pitch: "La bande des 12 mois avec les échéances surlignées, puis un forfait par type de structure.",
    palette: "Papier + vert-de-gris, surligneur ocre, Sora",
    aliases: "expert-comptable, cabinet comptable, comptabilité",
    demo: p("Cabinet Girard Expertise", "expertcomptable", "Angers", "02 41 60 22 75", 4.9, 47, "12 bd Foch, 49000 Angers"),
  },

  /* ── Éditorial générique ── */
  {
    key: "salon",
    family: "editorial",
    da: "Atelier (éditorial)",
    pitch: "Papier / encre, s'adapte à n'importe quelle niche. Sélectionnable en direct pendant un appel.",
    palette: "Papier + encre + accent de la niche",
    demo: p("Maison Camille", "coiffeur", "Angers", "02 41 88 12 45", 4.8, 127, "12 rue Saint-Laud, 49100 Angers"),
  },
];

export const SHOWCASE: ShowcaseEntry[] = SEEDS.map((s) => {
  const offer: ShowcaseEntry["offer"] = s.family === "editorial"
    ? "variable"
    : s.niche
      ? NICHE_KITS[s.niche].offer
      : s.sante
        ? SANTE_KITS[s.sante].offer
        : "vitrine";
  return {
    key: s.key,
    label: TEMPLATE_LABELS[s.key],
    family: s.family,
    da: s.da,
    pitch: s.pitch,
    palette: s.palette,
    metiers: metiersFor(s.key),
    aliases: s.aliases ?? null,
    offer,
    price: offer === "variable" ? null : OFFER_PRICE[offer],
    // Chaque maquette tire désormais son contenu d'un kit de son métier :
    // plus aucune ne récite le catalogue d'un autre.
    ownContent: true,
    demo: s.demo,
  };
});

export function showcaseEntry(key: string): ShowcaseEntry | undefined {
  return SHOWCASE.find((e) => e.key === key);
}
