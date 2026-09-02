// Générateur de hashtags Instagram « métier × petites villes FR ».
// PUR (testable). Importe le dataset communes-fr.json (bundle SERVEUR uniquement :
// ce module ne doit être importé que depuis des routes API / code serveur, jamais
// dans un composant client — le JSON fait ~450 Ko).
import communesData from "./data/communes-fr.json";

export interface Commune {
  nom: string;
  pop: number;
  dept: string;
}
const COMMUNES = communesData as Commune[]; // déjà trié par population décroissante

export interface HashtagRow {
  hashtag: string;
  ville: string; // "" pour un hashtag métier pur (sans ville)
  population: number; // 0 pour un hashtag métier pur
  dept: string; // "" pour un hashtag métier pur
  metier: string; // synonyme utilisé
  pattern: "metier+ville" | "ville+metier" | "metier" | "transversal";
}

export interface GenerateOptions {
  maxPop?: number; // exclut les communes au-dessus (défaut 100 000 = grandes villes)
  minPop?: number; // exclut les communes en dessous (défaut 1 000)
  departments?: string[]; // filtre par code département (ex. ["33","40"])
  limitTowns?: number; // ne prend que les N communes les plus peuplées du filtre
}

const dedupe = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

/** minuscules, sans accents, sans espaces/tirets/apostrophes/non-alphanum (forme hashtag). */
export function slugify(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques combinants
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Synonymes hashtag d'un métier (étend les niches connues), sinon le slug seul. */
const METIER_SYNONYMS: Record<string, string[]> = {
  coiffeur: ["coiffeur", "coiffure", "barbier", "salondecoiffure"],
  restaurant: ["restaurant", "resto"],
  traiteur: ["traiteur", "traiteurmariage", "buffet"],
  estheticienne: [
    "estheticienne", "institutbeaute", "ongles", "nailart",
    "prothesisteongulaire", "extensiondecils", "epilationlaser", "microblading",
  ],
  fleuriste: ["fleuriste", "fleurs", "artisanfleuriste"],
  tatoueur: ["tatoueur", "tattoo", "tatouage"],
  photographe: ["photographe", "photographemariage"],
  boulanger: ["boulanger", "boulangerie", "patisserie"],
  // Artisans du bâtiment (métiers visuels = les plus présents sur Instagram)
  menuisier: ["menuisier", "menuiserie", "ebeniste", "ebenisterie", "agencement"],
  paysagiste: ["paysagiste", "paysagisme", "amenagementexterieur"],
  carreleur: ["carreleur", "carrelage"],
  peintre: ["peintre", "peintreendecoration", "peintrebatiment"],
  macon: ["macon", "maconnerie"],
  couvreur: ["couvreur", "couverture", "toiture"],
  charpentier: ["charpentier", "charpente"],
  ferronnier: ["ferronnier", "ferronnerie", "metallerie"],
  plaquiste: ["plaquiste", "platrier", "placo"],
  cuisiniste: ["cuisiniste", "cuisinesurmesure"],
  plombier: ["plombier", "plomberie"],
  electricien: ["electricien", "electricite"],
  chauffagiste: ["chauffagiste", "chauffage"],
  // Professions libérales
  medecin: ["medecin", "medecingeneraliste", "cabinetmedical"],
  dentiste: ["dentiste", "chirurgiendentiste", "cabinetdentaire"],
  kine: ["kine", "kinesitherapeute", "masseurkinesitherapeute"],
  osteopathe: ["osteopathe", "osteopathie"],
  podologue: ["podologue", "pedicurepodologue"],
  orthophoniste: ["orthophoniste", "orthophonie"],
  psychologue: ["psychologue", "psychotherapeute"],
  sagefemme: ["sagefemme", "maieutique"],
  veterinaire: ["veterinaire", "cliniqueveterinaire"],
  dieteticien: ["dieteticien", "nutritionniste", "dieteticienne"],
  sophrologue: ["sophrologue", "sophrologie", "naturopathe"],
  avocat: ["avocat", "cabinetdavocats"],
  notaire: ["notaire", "etudenotariale"],
  expertcomptable: ["expertcomptable", "cabinetcomptable"],
};

/**
 * Bibliothèque de hashtags MÉTIER PURS (sans ville) — testés comme les plus
 * utilisés par les artisans/indés FR sur Instagram. Ce sont les plus qualifiés :
 * on scrape directement dessus, la géo n'a pas d'importance (méthode hashtag).
 */
const METIER_HASHTAGS: Record<string, string[]> = {
  menuisier: ["menuisier", "menuiserie", "ebeniste", "ebenisterie", "menuisiersurmesure", "menuiseriesurmesure", "agencement", "agencementsurmesure", "artisanmenuisier", "travaildubois", "atelierbois", "mobiliersurmesure"],
  paysagiste: ["paysagiste", "paysagisme", "amenagementexterieur", "amenagementpaysager", "jardinsurmesure", "creationjardin", "entretienjardin", "terrasseetjardin", "artisanpaysagiste"],
  carreleur: ["carreleur", "carrelage", "posecarrelage", "faience", "carrelagesalledebain", "artisancarreleur", "carrelagedesign"],
  peintre: ["peintre", "peintreendecoration", "peintrebatiment", "peintureinterieure", "decorationinterieure", "renovationpeinture", "artisanpeintre"],
  macon: ["macon", "maconnerie", "maconneriegenerale", "macontraditionnel", "pierredetaille", "grosoeuvre", "extensionmaison"],
  couvreur: ["couvreur", "couverture", "toiture", "zinguerie", "renovationtoiture", "artisancouvreur"],
  charpentier: ["charpentier", "charpente", "charpentebois", "ossaturebois"],
  ferronnier: ["ferronnerie", "ferronnierdart", "metallerie", "metallier", "gardecorps", "portailsurmesure"],
  plaquiste: ["plaquiste", "platrier", "placo", "platrerie", "isolation", "cloisonseche"],
  cuisiniste: ["cuisiniste", "cuisinesurmesure", "amenagementcuisine", "renovationsalledebain", "salledebainsurmesure"],
  plombier: ["plombier", "plomberie", "artisanplombier", "salledebain"],
  electricien: ["electricien", "electricite", "artisanelectricien", "renovationelectrique", "domotique"],
  chauffagiste: ["chauffagiste", "chauffage", "pompeachaleur", "climatisation"],
  coiffeur: ["coiffeur", "coiffure", "barbier", "salondecoiffure", "coiffeurcoloriste", "balayage", "coiffeuse"],
  restaurant: ["restaurant", "resto", "restaurantfrancais", "faitmaison", "bistrot"],
  traiteur: ["traiteur", "traiteurmariage", "traiteurevenementiel", "buffet", "cocktaildinatoire", "plateaurepas", "receptionmariage"],
  // Beauté — biais volontaire haut ticket (laser, cils, ongles, dermo) :
  // prestations 80–300 €, vraie culture Insta, budget pub envisageable.
  estheticienne: [
    "estheticienne", "institutbeaute", "institutdebeaute",
    // ongles
    "prothesisteongulaire", "onglerie", "nailart", "ongles",
    // cils / sourcils
    "extensiondecils", "rehaussementdecils", "volumerusse", "lashartist",
    "microblading", "dermopigmentation", "maquillagepermanent", "browartist",
    // épilation / soins techniques
    "epilationlaser", "epilationdefinitive", "cryolipolyse", "hifu",
    "microneedling", "soinvisage",
  ],
  fleuriste: ["fleuriste", "fleurs", "artisanfleuriste", "bouquetdefleurs", "fleuristecreateur"],
  tatoueur: ["tatoueur", "tattoo", "tatouage", "tatoueurfrancais", "inked"],
  photographe: ["photographe", "photographemariage", "photographeportrait", "photographefrancais", "seancephoto"],
  boulanger: ["boulanger", "boulangerie", "patisserie", "artisanboulanger", "painaulevain", "patissier"],
  // Professions LIBÉRALES (ajout 02/08/2026). Ces comptes publient moins que les
  // artisans : bibliothèques plus courtes, mais la reprise par curseur
  // (ig_hashtag_cursors) permet d'aller chercher loin dans chacune.
  medecin: ["medecingeneraliste", "cabinetmedical", "maisondesante", "medecinliberal", "teleconsultation"],
  dentiste: ["chirurgiendentiste", "cabinetdentaire", "dentiste", "orthodontie", "implantologie", "dentisterieesthetique"],
  kine: ["kinesitherapeute", "masseurkinesitherapeute", "kine", "cabinetdekine", "reeducation", "kinesport"],
  osteopathe: ["osteopathe", "osteopathie", "osteodo", "cabinetosteopathie", "osteopathiepediatrique"],
  podologue: ["pedicurepodologue", "podologue", "podologiedusport", "semellesorthopediques"],
  orthophoniste: ["orthophoniste", "orthophonie", "cabinetorthophonie"],
  psychologue: ["psychologue", "psychotherapeute", "psychologueliberal", "therapiebreve", "psychopraticien"],
  sagefemme: ["sagefemme", "sagefemmeliberale", "preparationalanaissance", "perinatalite"],
  veterinaire: ["veterinaire", "cliniqueveterinaire", "cabinetveterinaire", "vetolife"],
  dieteticien: ["dieteticienne", "dieteticien", "nutritionniste", "nutritionsante", "reequilibragealimentaire"],
  sophrologue: ["sophrologue", "sophrologie", "naturopathe", "naturopathie", "hypnotherapeute"],
  avocat: ["avocat", "cabinetdavocats", "avocatdroitdutravail", "avocatdroitdelafamille", "barreau"],
  notaire: ["notaire", "etudenotariale", "notairefrance"],
  expertcomptable: ["expertcomptable", "cabinetcomptable", "comptabilite", "expertisecomptable"],
};

/**
 * Hashtags TRANSVERSAUX bâtiment/artisanat : gros volume mais bruités
 * (marques, fournisseurs, particuliers) → à filtrer sévèrement derrière
 * (qualification IA + double check). Signalés `pattern: "transversal"`.
 */
const TRANSVERSAL_HASHTAGS = [
  "renovation", "renovationmaison", "renovationinterieure", "artisandubatiment",
  "artisanat", "artisanfrancais", "btp", "travaux", "chantier", "avantapres",
  "faitmain", "savoirfaire", "madeinfrance",
];

/**
 * Génère les hashtags MÉTIER PURS (sans ville) pour un métier donné :
 * bibliothèque dédiée si connue, sinon synonymes slugifiés. Ajoute les
 * transversaux si `includeTransversal`. C'est le mode le plus qualifié.
 */
export function generateMetierHashtags(
  metier: string,
  opts: { includeTransversal?: boolean } = {},
): HashtagRow[] {
  const slug = slugify(metier);
  if (!slug) return [];
  // Retrouve la clé canonique (le métier lui-même ou l'un de ses synonymes).
  let key: string | null = null;
  for (const [k, syns] of Object.entries(METIER_SYNONYMS)) {
    if (slug === slugify(k) || syns.includes(slug)) {
      key = k;
      break;
    }
  }
  const tags = key && METIER_HASHTAGS[key] ? METIER_HASHTAGS[key] : metierSynonyms(metier);
  const rows: HashtagRow[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    rows.push({ hashtag: tag, ville: "", population: 0, dept: "", metier: key ?? slug, pattern: "metier" });
  }
  if (opts.includeTransversal) {
    for (const tag of TRANSVERSAL_HASHTAGS) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      rows.push({ hashtag: tag, ville: "", population: 0, dept: "", metier: key ?? slug, pattern: "transversal" });
    }
  }
  return rows;
}

export function metierSynonyms(metier: string): string[] {
  const slug = slugify(metier);
  if (!slug) return [];
  for (const [key, syns] of Object.entries(METIER_SYNONYMS)) {
    if (slug === slugify(key) || syns.some((s) => s === slug)) return dedupe(syns);
  }
  return [slug];
}

/**
 * Génère la liste de hashtags candidats (métier × communes filtrées).
 * Patterns : `${metier}${ville}` et `${ville}${metier}`. Dédupliqués.
 * Ordre = communes les plus peuplées d'abord (proxy d'activité Instagram).
 */
export function generateHashtags(metier: string, opts: GenerateOptions = {}): HashtagRow[] {
  const { maxPop = 100_000, minPop = 1_000, departments, limitTowns } = opts;
  const syns = metierSynonyms(metier);
  if (!syns.length) return [];

  const depSet = departments && departments.length ? new Set(departments.map((d) => d.trim())) : null;
  let towns = COMMUNES.filter((c) => c.pop >= minPop && c.pop <= maxPop && (!depSet || depSet.has(c.dept)));
  if (limitTowns && limitTowns > 0) towns = towns.slice(0, limitTowns);

  const seen = new Set<string>();
  const rows: HashtagRow[] = [];
  for (const t of towns) {
    const vslug = slugify(t.nom);
    if (!vslug) continue;
    for (const m of syns) {
      const variants: [HashtagRow["pattern"], string][] = [
        ["metier+ville", `${m}${vslug}`],
        ["ville+metier", `${vslug}${m}`],
      ];
      for (const [pattern, tag] of variants) {
        if (seen.has(tag)) continue;
        seen.add(tag);
        rows.push({ hashtag: tag, ville: t.nom, population: t.pop, dept: t.dept, metier: m, pattern });
      }
    }
  }
  return rows;
}
