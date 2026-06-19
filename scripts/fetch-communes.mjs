// Génère app/lib/data/communes-fr.json depuis l'API publique geo.api.gouv.fr.
// Filtre les communes de 1 000 à 100 000 habitants (exclut les grandes villes >100k).
// Sortie triée par population décroissante. À relancer à la main pour rafraîchir.
//   node scripts/fetch-communes.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const MIN_POP = 1_000;
const MAX_POP = 100_000;
const OUT = resolve(import.meta.dirname, "..", "app", "lib", "data", "communes-fr.json");

const res = await fetch("https://geo.api.gouv.fr/communes?fields=nom,population,codeDepartement&format=json");
if (!res.ok) throw new Error(`geo.api.gouv.fr HTTP ${res.status}`);
const all = await res.json();

const communes = all
  .filter((c) => c.population && c.population >= MIN_POP && c.population <= MAX_POP && c.nom)
  .map((c) => ({ nom: c.nom, pop: c.population, dept: c.codeDepartement ?? "" }))
  .sort((a, b) => b.pop - a.pop);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(communes), "utf8");
console.log(`✔ ${communes.length} communes écrites dans ${OUT}`);
console.log(`  top: ${communes.slice(0, 3).map((c) => `${c.nom}(${c.pop})`).join(", ")}`);
