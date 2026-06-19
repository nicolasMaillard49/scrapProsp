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
  ville: string;
  population: number;
  dept: string;
  metier: string; // synonyme utilisé
  pattern: "metier+ville" | "ville+metier";
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
  estheticienne: ["estheticienne", "institutbeaute", "ongles", "nailart"],
  fleuriste: ["fleuriste", "fleurs", "artisanfleuriste"],
  tatoueur: ["tatoueur", "tattoo", "tatouage"],
  photographe: ["photographe", "photographemariage"],
  boulanger: ["boulanger", "boulangerie", "patisserie"],
};

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
