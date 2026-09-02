/**
 * GP elec — la saison, sur plusieurs annees au lieu d'une seule.
 *
 * Le probleme. generateKeywordHistoricalMetrics renvoie par defaut 12 mois de
 * monthly_search_volumes. Sur la passe du 02/09 la serie va d'aout 2025 a
 * juillet 2026. Conclusion : le "septembre" du dossier est SEPTEMBRE 2025, et
 * il n'existe aucune donnee pour septembre 2026 — le mois n'est pas fini.
 *
 * Plus genant : avec une seule serie de 12 mois on ne peut pas separer la SAISON
 * de la CROISSANCE. La famille climatisation fait 1 020 en juillet 2025 et 5 830
 * en juin 2026. Est-ce un pic de juin, ou un marche qui a explose en un an ?
 * Indecidable sans juin 2025 pour comparer a juin 2026.
 *
 * La reponse tient dans un champ jamais demande : historical_metrics_options
 * .year_month_range, qui remonte jusqu'a 4 ans. Ce script tente 48 mois, puis
 * degrade a 36 et 24 si l'API refuse, et journalise ce qui a ete accepte.
 *
 * Avec deux septembres et deux juins on peut enfin ecrire "septembre pese X % de
 * la moyenne annuelle, tous les ans" au lieu de melanger deux millesimes.
 *
 * Lecture seule : un seul type d'appel, aucune ecriture cote Google.
 *
 *   cd C:/Users/n.maillard/VueJS/scrapProsp
 *   node --import tsx scripts/audit-gp-elec-saison-multi-annees.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

/** .env.local du checkout + bloc GOOGLE_ADS_* du vault (absents du .env.local ici). */
const loadEnv = (path, filter = () => true) => {
  let raw;
  try { raw = readFileSync(path, "utf8"); } catch { return 0; }
  let n = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(k) || !filter(k)) continue;
    if (process.env[k] === undefined) { process.env[k] = v; n++; }
  }
  return n;
};
loadEnv(new URL("../.env.local", import.meta.url));
const fromVault = loadEnv("C:/Users/n.maillard/Obsidian/Cerveau/Credentials.md", (k) => k.startsWith("GOOGLE_ADS_"));
console.log(`Credentials : ${fromVault} variables GOOGLE_ADS_* reprises du vault`);

const { enums } = await import("google-ads-api");
const { mccCustomer, MCC_ID } = await import("../app/lib/googleAds/client.ts");

const AUDIT = "C:/Users/n.maillard/audit-nmf/gpelec";
const PORTFOLIO = JSON.parse(readFileSync(`${AUDIT}/data/portefeuille-mots-cles.json`, "utf8"));
const ZONE = JSON.parse(readFileSync(`${AUDIT}/data/donnees-zone-brissac-angers-2026-09-02.json`, "utf8"));
const OUT = `${AUDIT}/data/saison-multi-annees-2026-09-02.json`;

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const LANG = "languageConstants/1002";
const NETWORK = enums.KeywordPlanNetwork.GOOGLE_SEARCH;
/* L'appel historique refuse plus de 10 cibles (INVALID_VALUE, mesure du 02/09) :
   on prend le coeur de la zone retenue, comme pour le complement. */
const GEO = ZONE.geo.slice(0, 10).map((g) => g.geo);
const NOMS = ZONE.geo.slice(0, 10).map((g) => g.commune);

const KEYWORDS = PORTFOLIO.keywords.map((k) => k.text);
const FAMILLE_OF = Object.fromEntries(PORTFOLIO.keywords.map((k) => [norm(k.text), k.famille]));

const MOIS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
/* Dernier mois complet publie : juillet 2026 d'apres la passe du 02/09. */
const FIN = { year: 2026, month: "JULY" };
const DEBUTS = [
  { mois: 48, start: { year: 2022, month: "AUGUST" } },
  { mois: 36, start: { year: 2023, month: "AUGUST" } },
  { mois: 24, start: { year: 2024, month: "AUGUST" } },
];

const out = {
  meta: {
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24 / generateKeywordHistoricalMetrics",
    question: "juin est-il un pic de saison, ou le marche a-t-il simplement grossi en un an ?",
    pourquoi: "Le defaut de l'API est 12 mois : la serie du 02/09 va d'aout 2025 a juillet 2026. Un seul juin et un seul septembre ne permettent pas de separer saison et croissance.",
    zone: NOMS,
    zone_note: "Coeur de la zone retenue. L'appel historique refuse plus de 10 geo_target_constants (INVALID_VALUE).",
    langue: LANG, reseau: "GOOGLE_SEARCH",
    fin_de_serie: FIN,
    tentatives: [],
  },
  plage_obtenue: null,
  historical: [],
  errors: [],
};
mkdirSync(dirname(OUT), { recursive: true });
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

const mapMonths = (m) => (m?.monthly_search_volumes ?? []).map((x) => ({
  m: `${x.year}-${String(x.month)}`,
  v: x.monthly_searches != null ? Number(x.monthly_searches) : null,
}));

let obtenu = null;
for (const essai of DEBUTS) {
  console.log(`\nTentative — ${essai.mois} mois (${essai.start.year}-${essai.start.month} -> ${FIN.year}-${FIN.month})`);
  try {
    const res = await cust.keywordPlanIdeas.generateKeywordHistoricalMetrics({
      customer_id: MCC_ID,
      keywords: KEYWORDS,
      language: LANG,
      geo_target_constants: GEO,
      keyword_plan_network: NETWORK,
      include_adult_keywords: false,
      historical_metrics_options: {
        year_month_range: {
          start: { year: essai.start.year, month: enums.MonthOfYear[essai.start.month] },
          end: { year: FIN.year, month: enums.MonthOfYear[FIN.month] },
        },
      },
    });
    const rows = res?.results ?? (Array.isArray(res) ? res : []);
    const avecSerie = rows.filter((r) => (r.keyword_metrics?.monthly_search_volumes ?? []).length);
    const longueur = avecSerie.length ? avecSerie[0].keyword_metrics.monthly_search_volumes.length : 0;
    console.log(`  accepte — ${rows.length} lignes, serie de ${longueur} mois`);
    out.meta.tentatives.push({ mois_demandes: essai.mois, accepte: true, mois_rendus: longueur });
    if (longueur > 12) {
      obtenu = { demande: essai.mois, rendu: longueur, start: essai.start, end: FIN };
      for (const r of rows) {
        out.historical.push({
          text: r.text ?? "",
          famille: FAMILLE_OF[norm(r.text)] ?? null,
          vol: r.keyword_metrics?.avg_monthly_searches != null ? Number(r.keyword_metrics.avg_monthly_searches) : null,
          months: mapMonths(r.keyword_metrics),
        });
      }
      break;
    }
    console.log(`  ... mais l'API n'a rendu que ${longueur} mois : on degrade.`);
  } catch (e) {
    const err = e?.errors?.[0];
    const code = JSON.stringify(err?.error_code ?? e?.message ?? e);
    const msg = err?.message ?? String(e?.message ?? e);
    console.log(`  REFUSE — ${code} : ${msg}`);
    out.meta.tentatives.push({ mois_demandes: essai.mois, accepte: false, code, message: msg });
    out.errors.push({ phase: "historical", mois_demandes: essai.mois, code, message: msg });
  }
  await sleep(6_000);
}

out.plage_obtenue = obtenu;
save();

if (!obtenu) {
  console.log(`\nAucune plage superieure a 12 mois n'a ete obtenue. Le dossier reste sur une seule annee, et la saison ne peut pas etre separee de la croissance.`);
  console.log(OUT);
  process.exit(0);
}

/* ---------- lecture : saison par famille, annee par annee ---------- */
const parFamille = {};
for (const k of out.historical) {
  const f = k.famille ?? "?";
  parFamille[f] = parFamille[f] || {};
  for (const m of k.months) {
    if (m.v == null) continue;
    parFamille[f][m.m] = (parFamille[f][m.m] || 0) + m.v;
  }
}

const cle = (y, mo) => `${y}-${mo}`;
const annees = [...new Set(out.historical.flatMap((k) => k.months.map((m) => Number(m.m.split("-")[0]))))].sort();
console.log(`\nSerie obtenue : ${obtenu.rendu} mois, ${annees[0]} -> ${annees.at(-1)}`);

out.saison = {};
for (const [f, mois] of Object.entries(parFamille)) {
  const total = Object.values(mois).reduce((a, b) => a + b, 0);
  const moyenne = total / Object.keys(mois).length;
  const parMois = {};
  for (const mo of MOIS) {
    const vals = annees.map((y) => mois[cle(y, mo)]).filter((v) => v != null);
    if (!vals.length) continue;
    parMois[mo] = {
      valeurs: Object.fromEntries(annees.map((y) => [y, mois[cle(y, mo)] ?? null]).filter(([, v]) => v != null)),
      moyenne: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      indice: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length / moyenne) * 100),
    };
  }
  out.saison[f] = { moyenne_mensuelle: Math.round(moyenne), mois: parMois };
}
save();

console.log(`\nINDICE DE SAISON — 100 = moyenne de la periode, moyenne sur ${annees.length} annees`);
for (const f of Object.keys(out.saison).sort()) {
  const s = out.saison[f];
  const ligne = MOIS.filter((m) => s.mois[m]).map((m) => `${m.slice(0, 3)} ${String(s.mois[m].indice).padStart(3)}`).join("  ");
  console.log(`  ${f} (moy ${s.moyenne_mensuelle}/mois)`);
  console.log(`     ${ligne}`);
}

console.log(`\nTermine — ${out.historical.length} lignes, ${out.errors.length} erreur(s)`);
console.log(OUT);
