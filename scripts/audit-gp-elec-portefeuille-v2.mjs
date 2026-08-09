/**
 * Construit le portefeuille v2 de GP elec a partir de la decouverte du 04/08.
 *
 * Regle de non-gonflement : un candidat dont le couple (volume, enchere haute)
 * est deja porte par une ligne du portefeuille est une variante proche que
 * Google n a pas fusionnee lui-meme. L ajouter compterait deux fois la meme
 * demande. Ces cas sont ecartes et traces.
 *
 *   node scripts/audit-gp-elec-portefeuille-v2.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const AUDIT = "D:/projets/audit/gpelec";
const v1 = JSON.parse(readFileSync(`${AUDIT}/data/portefeuille-mots-cles.json`, "utf8"));
const raw = JSON.parse(readFileSync(`${AUDIT}/data/donnees-google-ads-brutes-2026-08-04.json`, "utf8"));

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const sig = (k) => `${k.vol}|${(k.bidHigh || 0).toFixed(2)}`;
const bySig = new Map(raw.historical.map((k) => [sig(k), k.text]));
const cand = new Map(raw.historical_candidats.map((k) => [norm(k.text), k]));

/* Retenus : service reellement vendu d apres la page d accueil du 04/08
   (clim reversible / PAC air-air, neuf, renovation + Consuel, cuisine,
   depannage urgence, domotique incluant volets et securite Somfy). */
const AJOUTS = [
  { text: "climatiseur reversible",          famille: "A", intention: "commerciale",       geo: "sans ville" },
  { text: "pompe a chaleur reversible",      famille: "A", intention: "commerciale",       geo: "sans ville" },
  { text: "prix installation climatisation", famille: "A", intention: "commerciale forte", geo: "sans ville" },
  { text: "electricien autour de moi",       famille: "C", intention: "commerciale forte", geo: "sans ville" },
  { text: "consuel",                         famille: "D", intention: "informationnelle",  geo: "sans ville" },
  { text: "volet roulant electrique",        famille: "G", intention: "commerciale",       geo: "sans ville" },
  { text: "alarme somfy",                    famille: "G", intention: "commerciale",       geo: "sans ville" },
];

/* Ecartes malgre un volume reel — chacun avec son motif verifiable. */
const NOUVELLES_EXCLUSIONS = [
  { text: "borne de recharge de vehicule electrique", volume: 2410, raison: "Famille entiere (22 requetes canoniques, ~2 410 rech./mois) : GP elec ne vend pas l installation de bornes de recharge, aucune mention sur le site au 04/08. Traite comme gisement hors offre, jamais compte dans le marche adressable." },
  { text: "alarme maison", volume: 720, raison: "Enchere haut de page 14,25 EUR, soit 9x le CPC tenu du plan. Un seul clic consommerait 7 % du budget mensuel. Ecarte pour raison economique, pas de pertinence." },
  { text: "clim portative / clim monobloc / climatiseur", volume: 210, raison: "Achat de produit en grande surface, pas de pose. Coherent avec les exclusions v1." },
  { text: "prise electrique / prise anglaise / plan electrique", volume: 270, raison: "Requetes produit ou bricolage, enchere haut de page a 0,00 EUR : aucun annonceur ne paie dessus." },
  { text: "electricite de france / borne de recharge electra", volume: 410, raison: "Marques tierces. Exclues par principe." },
  { text: "nfc 15_100 / prix electricite", volume: 90, raison: "Requetes informationnelles : la norme et le prix du kWh, pas un prestataire." },
  { text: "depannage electricite angers / entreprise electricite angers", volume: 100, raison: "Mots-cles avec ville : le ciblage geographique de la campagne localise deja la diffusion. Principe pose en v1, maintenu." },
  { text: "climatisation gainable / clim gainee", volume: 210, raison: "GP elec pose du mono-split et du multi-split. Le gainable n est pas au catalogue." },
  { text: "chauffe eau electrique / chauffe eau instantane", volume: 190, raison: "Non mentionne dans l offre du site au 04/08." },
];

const ecartes = [];
const retenus = [];
for (const a of AJOUTS) {
  const k = cand.get(norm(a.text));
  if (!k) { ecartes.push({ ...a, motif: "absent des candidats mesures" }); continue; }
  const dup = bySig.get(sig(k));
  if (dup) { ecartes.push({ ...a, motif: `variante proche de "${dup}" (meme volume et meme enchere)` }); continue; }
  retenus.push({ ...a, volume: k.vol, encheresHaute: k.bidHigh });
}

const v2 = {
  meta: {
    ...v1.meta,
    date: "2026-08-04",
    version: 2,
    revision: "Portefeuille v1 confronte a generateKeywordIdeas (2 lots de graines metier + seed sur l URL du site, 20 234 idees brutes). Les candidats a volume >= 30 absents du portefeuille ont ete remesures en historical metrics, puis filtres : marques, produits nus, requetes informationnelles, mots-cles avec ville et variantes proches non fusionnees par Google.",
    principe_non_gonflement: "Un candidat dont le couple (volume, enchere haute) est deja porte par une ligne du portefeuille est une variante que Google n a pas fusionnee. L ajouter compterait deux fois la meme demande.",
  },
  familles: v1.familles,
  keywords: [
    ...v1.keywords,
    ...retenus.map((r, i) => ({ n: v1.keywords.length + i + 1, text: r.text, famille: r.famille, intention: r.intention, geo: r.geo, ajoute_le: "2026-08-04" })),
  ],
  exclusions: [...v1.exclusions, ...NOUVELLES_EXCLUSIONS],
  revision_2026_08_04: {
    candidats_mesures: raw.historical_candidats.length,
    volume_candidats: raw.historical_candidats.reduce((a, k) => a + (k.vol || 0), 0),
    retenus: retenus.map((r) => ({ text: r.text, famille: r.famille, volume: r.volume, encheresHaute: r.encheresHaute })),
    volume_ajoute: retenus.reduce((a, r) => a + r.volume, 0),
    ecartes_variantes_proches: ecartes,
  },
};

writeFileSync(`${AUDIT}/data/portefeuille-mots-cles.json`, JSON.stringify(v2, null, 1));
console.log(`v1 : ${v1.keywords.length} mots-cles`);
console.log(`retenus : ${retenus.length} (+${v2.revision_2026_08_04.volume_ajoute} rech./mois)`);
for (const r of retenus) console.log(`  ${r.famille}  ${String(r.volume).padStart(4)}  ${r.encheresHaute?.toFixed(2)} EUR  ${r.text}`);
console.log(`ecartes : ${ecartes.length}`);
for (const e of ecartes) console.log(`  ${e.text} — ${e.motif}`);
console.log(`v2 : ${v2.keywords.length} mots-cles, ${v2.exclusions.length} exclusions motivees`);
