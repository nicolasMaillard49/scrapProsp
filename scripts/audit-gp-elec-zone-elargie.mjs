/**
 * GP elec — jusqu'ou peut-on pousser la depense en elargissant la ZONE ?
 *
 * Contexte. Les dix communes du 04/08 viennent d'une limite technique de
 * generateKeywordIdeas (10 geo_target_constants par requete). Cette limite ne
 * s'applique PAS a generateKeywordForecastMetrics. Le marche mesure est donc
 * volontairement conservateur, et c'est peut-etre la vraie raison pour laquelle
 * seule la climatisation absorbe un budget : pas assez de communes comptees.
 *
 * Mesures deja acquises (fenetre septembre 2026, dix communes, plafond 2,07) :
 *   portefeuille  197,40 EUR / 132 clics / CPC 1,50
 *   famille A     197,40 EUR / 121 clics   <- porte tout
 *   C+D+G a 5,20  111,55 EUR /  59 clics   <- plafond hors clim
 *   famille C : monter le plafond de 2,07 a 5,20 ne rend que 6 clics de plus
 *
 * Ce script balaie ZONE x PERIMETRE x ENCHERE x BUDGET sur la fenetre de
 * septembre, avec des budgets pousses jusqu'a 1 500 EUR pour repondir a la
 * question : peut-on viser 500 EUR de depense mensuelle reelle, et a quel prix
 * du clic ? Un controle de saison est refait sur la meilleure zone.
 *
 * Robustesse
 *  - reprise : si le JSON de sortie existe, les combinaisons deja calculees
 *    sont ignorees. Le script est relancable sans reperdre les appels.
 *  - zones trop larges : si l'API refuse une liste de communes, elle est
 *    tronquee (100 -> 50 -> 20 -> 10) et la troncature est journalisee.
 *  - UNKNOWN n'est jamais rejoue : c'est une erreur de validation deguisee
 *    (MinCpcBidMicros). Seuls RESOURCE_EXHAUSTED / INTERNAL / DEADLINE le sont.
 *
 * Lecture seule cote Google : uniquement des previsions, rien n'est cree.
 *
 *   cd D:/projets/scrapProsp
 *   node --import tsx scripts/audit-gp-elec-zone-elargie.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

const { enums } = await import("google-ads-api");
const { mccCustomer, MCC_ID } = await import("../app/lib/googleAds/client.ts");
const { resolveGeoTargetConstant } = await import("../app/lib/googleAds/keywordIdeas.ts");

const AUDIT = "D:/projets/audit/gpelec";
const BRUT = JSON.parse(readFileSync(`${AUDIT}/data/donnees-google-ads-brutes-2026-08-04.json`, "utf8"));
const PORTFOLIO = JSON.parse(readFileSync(`${AUDIT}/data/portefeuille-mots-cles.json`, "utf8"));
const OUT = `${AUDIT}/data/zone-elargie-2026-08-05.json`;

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;
const r10k = (micros) => Math.max(10_000, Math.round(micros / 10_000) * 10_000);

const LANG = "languageConstants/1002";
const PERIODE_SEPT = { cle: "septembre-2026", start_date: "2026-09-01", end_date: "2026-09-30" };
const PERIODE_JUIN = { cle: "juin-2027", start_date: "2027-06-01", end_date: "2027-06-30" };

/* ── Zones ────────────────────────────────────────────────────────────────── */
const DIX_COMMUNES = BRUT.meta.communes;

/* Communes du rayon ~30 km autour de Brissac Loire Aubance jamais comptees.
   Certaines ont fusionne (Loire-Authion, Gennes-Val-de-Loire...) et peuvent ne
   pas se resoudre seules : on garde ce que Google resout, on journalise le reste. */
const RING_30KM = [
  "Beaucouze", "Ecouflant", "Montreuil-Juigne", "Cantenay-Epinard", "Sainte-Gemmes-sur-Loire",
  "Murs-Erigne", "Saint-Leger-de-Linieres", "Saint-Lambert-la-Potherie", "Feneu", "Briollay",
  "Rives-du-Loir-en-Anjou", "Saint-Clement-de-la-Place", "Longuenee-en-Anjou", "Sarrigne",
  "Soulaire-et-Bourg", "Tierce", "Seiches-sur-le-Loir", "Ecuille", "Juvardeil",
  "Moze-sur-Louet", "Denee", "Rochefort-sur-Loire", "Chalonnes-sur-Loire", "Savennieres",
  "Behuard", "Saint-Jean-de-la-Croix", "Terranjou", "Bellevigne-en-Layon", "Chemille-en-Anjou",
  "Gennes-Val-de-Loire", "Blaison-Saint-Sulpice", "Saint-Mathurin-sur-Loire", "Maze-Milon",
  "Loire-Authion", "Corne", "Andard", "Brain-sur-l-Authion", "Juigne-sur-Loire",
  "Saint-Melaine-sur-Aubance", "Vauchretien", "Charce-Saint-Ellier-sur-Aubance",
  "Saint-Saturnin-sur-Loire", "Mozelle", "Le Plessis-Grammoire", "Saint-Barthelemy-d-Anjou",
];

const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {
  meta: {
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24 / generateKeywordForecastMetrics",
    question: "elargir la zone permet-il de depenser un vrai budget hors climatisation, et peut-on viser 500 EUR/mois ?",
    pourquoi_dix_communes: "generateKeywordIdeas plafonne a 10 geo_target_constants. generateKeywordForecastMetrics n'a pas cette limite : la zone de l'audit etait donc conservatrice par contrainte d'outil, pas par choix de marche.",
    limite_api: "ni impressions, ni CTR, ni position — v24",
    zone_declaree_client: "Brissac Loire Aubance, Angers et Maine-et-Loire, rayon 30 km",
  },
  zones: [],
  previsions: [],
  errors: [],
};
mkdirSync(dirname(OUT), { recursive: true });
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

/* ── Resolution geo, avec cache dans le fichier de sortie ─────────────────── */
const geoCache = out.meta.geo_cache ?? (out.meta.geo_cache = {});
async function geo(nom) {
  if (geoCache[nom] !== undefined) return geoCache[nom];
  const g = await resolveGeoTargetConstant(cust, nom);
  geoCache[nom] = g;
  save();
  await sleep(400);
  return g;
}

console.log("Resolution geographique");
const dix = [];
for (const c of DIX_COMMUNES) { const g = await geo(c); if (g) dix.push(g); }
console.log(`  dix communes : ${dix.length}/${DIX_COMMUNES.length}`);

const ring = [];
const ringEchecs = [];
for (const c of RING_30KM) { const g = await geo(c); if (g) ring.push(g); else ringEchecs.push(c); }
console.log(`  couronne 30 km : ${ring.length}/${RING_30KM.length} resolues, ${ringEchecs.length} non resolues`);

const dept = await geo("Maine-et-Loire");
const region = await geo("Pays de la Loire");
console.log(`  departement : ${dept ?? "NON RESOLU"} · region : ${region ?? "NON RESOLU"}`);

const uniq = (a) => [...new Set(a.filter(Boolean))];
const ZONES = [
  { cle: "Z1-dix-communes", label: "Les dix communes de l'audit (reference)", geo: dix },
  { cle: "Z2-rayon-30km",   label: "Dix communes + couronne des 30 km",       geo: uniq([...dix, ...ring]) },
  ...(dept   ? [{ cle: "Z3-maine-et-loire",   label: "Departement Maine-et-Loire (zone declaree)", geo: [dept] }] : []),
  ...(region ? [{ cle: "Z4-pays-de-la-loire", label: "Region Pays de la Loire (borne haute, HORS zone declaree)", geo: [region] }] : []),
];
out.zones = ZONES.map((z) => ({ cle: z.cle, label: z.label, cibles: z.geo.length }));
out.meta.couronne_non_resolue = ringEchecs;
save();

/* ── Perimetres ───────────────────────────────────────────────────────────── */
const kwOf = (...codes) => PORTFOLIO.keywords.filter((k) => codes.includes(k.famille)).map((k) => k.text);
const PERIMETRES = [
  { cle: "TOUT", label: "Portefeuille entier",            keywords: PORTFOLIO.keywords.map((k) => k.text) },
  { cle: "CDG",  label: "Hors climatisation (C + D + G)", keywords: kwOf("C", "D", "G") },
  { cle: "C",    label: "Electricien general seul",       keywords: kwOf("C") },
  { cle: "A",    label: "Climatisation seule",            keywords: kwOf("A") },
];

/* ── Encheres ─────────────────────────────────────────────────────────────── */
const ENCHERES = [
  { cle: "cpc-2.07", type: "manuel", plafond: 2.07 },
  { cle: "cpc-3.50", type: "manuel", plafond: 3.50 },
  { cle: "cpc-5.20", type: "manuel", plafond: 5.20 },
  { cle: "max-clics", type: "maximisation" },
];
const BUDGETS = [200, 500, 1000, 1500];

function biddingStrategy(enchere, monthly) {
  const daily = r10k((monthly / 30.4) * 1e6);
  if (enchere.type === "maximisation") return { maximize_clicks_bidding_strategy: { daily_target_spend_micros: daily } };
  return { manual_cpc_bidding_strategy: { max_cpc_bid_micros: r10k(enchere.plafond * 1e6), daily_budget_micros: daily } };
}

const adGroupsFrom = (kw) => [{ keywords: kw.map((t) => ({ text: t, match_type: enums.KeywordMatchType.PHRASE })) }];

async function forecast(periode, geoList, enchere, monthly, keywords) {
  let wait = 25_000;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await cust.keywordPlanIdeas.generateKeywordForecastMetrics({
        customer_id: MCC_ID,
        currency_code: "EUR",
        forecast_period: { start_date: periode.start_date, end_date: periode.end_date },
        campaign: {
          language_constants: [LANG],
          geo_target_constants: geoList,
          bidding_strategy: biddingStrategy(enchere, monthly),
          ad_groups: adGroupsFrom(keywords),
        },
      });
      const m = res?.campaign_forecast_metrics ?? {};
      return {
        ok: true,
        clicks: m.clicks != null ? Number(m.clicks) : null,
        cost: m.cost_micros != null ? euros(m.cost_micros) : null,
        cpc: m.average_cpc_micros != null ? euros(m.average_cpc_micros) : null,
        attempts: attempt,
      };
    } catch (e) {
      const err = e?.errors?.[0];
      const code = JSON.stringify(err?.error_code ?? e?.message ?? e);
      const msg = err?.message ?? String(e?.message ?? "");
      if (!/RESOURCE_EXHAUSTED|INTERNAL|DEADLINE/.test(code) || attempt === 6) {
        return { ok: false, error: code, message: msg, attempts: attempt };
      }
      console.log(`       quota — attente ${wait / 1000}s (essai ${attempt}/6)`);
      await sleep(wait);
      wait = Math.min(wait * 2, 180_000);
    }
  }
}

/* Une zone trop large peut etre refusee : on tronque et on journalise. */
const zoneGeoUtilise = {};
async function geoPourZone(z) {
  if (zoneGeoUtilise[z.cle]) return zoneGeoUtilise[z.cle];
  const paliers = [z.geo.length, 100, 50, 20, 10].filter((n, i, a) => n <= z.geo.length && a.indexOf(n) === i);
  for (const n of paliers) {
    const sousEnsemble = z.geo.slice(0, n);
    const probe = await forecast(PERIODE_SEPT, sousEnsemble, ENCHERES[0], 200, PERIMETRES[2].keywords.slice(0, 5));
    if (probe.ok) {
      if (n < z.geo.length) {
        out.errors.push({ phase: "zone-tronquee", zone: z.cle, demande: z.geo.length, retenu: n });
        console.log(`    zone tronquee : ${z.geo.length} -> ${n} cibles`);
      }
      zoneGeoUtilise[z.cle] = sousEnsemble;
      save();
      await sleep(7_000);
      return sousEnsemble;
    }
    console.log(`    ${n} cibles refusees (${probe.error}) — on tronque`);
    await sleep(7_000);
  }
  out.errors.push({ phase: "zone-impossible", zone: z.cle, demande: z.geo.length });
  zoneGeoUtilise[z.cle] = null;
  save();
  return null;
}

const dejaFait = new Set(out.previsions.map((p) => `${p.fenetre}|${p.zone}|${p.perimetre}|${p.enchere}|${p.budget_mensuel}`));

const total = ZONES.length * PERIMETRES.length * ENCHERES.length * BUDGETS.length;
console.log(`\n${ZONES.length} zones x ${PERIMETRES.length} perimetres x ${ENCHERES.length} encheres x ${BUDGETS.length} budgets = ${total} previsions`);
console.log(`deja en cache : ${dejaFait.size}\n`);

let n = 0;
for (const z of ZONES) {
  console.log(`\n########## ${z.cle} — ${z.label} (${z.geo.length} cibles) ##########`);
  const geoList = await geoPourZone(z);
  if (!geoList) { console.log("  zone inutilisable, on passe"); n += PERIMETRES.length * ENCHERES.length * BUDGETS.length; continue; }
  for (const p of PERIMETRES) {
    console.log(`\n  --- ${p.cle} (${p.keywords.length} mots-cles) ---`);
    for (const e of ENCHERES) {
      for (const b of BUDGETS) {
        n++;
        const cle = `${PERIODE_SEPT.cle}|${z.cle}|${p.cle}|${e.cle}|${b}`;
        if (dejaFait.has(cle)) continue;
        const r = await forecast(PERIODE_SEPT, geoList, e, b, p.keywords);
        const taux = r.ok && r.cost != null ? Math.round(100 * r.cost / b) : null;
        out.previsions.push({
          fenetre: PERIODE_SEPT.cle, zone: z.cle, perimetre: p.cle, enchere: e.cle,
          budget_mensuel: b, taux_de_depense_pct: taux, geo_cibles: geoList.length, ...r,
        });
        if (!r.ok) out.errors.push({ phase: "forecast", ...JSON.parse(JSON.stringify({ zone: z.cle, perimetre: p.cle, enchere: e.cle, budget: b, error: r.error, message: r.message })) });
        console.log(r.ok
          ? `    ${e.cle.padEnd(9)} ${String(b).padStart(4)} EUR -> ${String(r.cost?.toFixed(2)).padStart(8)} EUR (${String(taux).padStart(3)}%) · ${String(r.clicks?.toFixed(0)).padStart(4)} clics · CPC ${r.cpc?.toFixed(2) ?? "--"}   [${n}/${total}]`
          : `    ${e.cle.padEnd(9)} ${String(b).padStart(4)} EUR -> ERREUR ${r.error}   [${n}/${total}]`);
        save();
        await sleep(7_000);
      }
    }
  }
}

/* ── Controle de saison sur la zone la plus large exploitable ─────────────── */
const zonesOk = ZONES.filter((z) => zoneGeoUtilise[z.cle]);
const zoneLarge = zonesOk[zonesOk.length - 1];
if (zoneLarge) {
  console.log(`\n########## controle de saison — juin 2027 sur ${zoneLarge.cle} ##########`);
  for (const p of PERIMETRES) {
    for (const b of [200, 500]) {
      const e = ENCHERES[2];
      const cle = `${PERIODE_JUIN.cle}|${zoneLarge.cle}|${p.cle}|${e.cle}|${b}`;
      if (dejaFait.has(cle)) continue;
      const r = await forecast(PERIODE_JUIN, zoneGeoUtilise[zoneLarge.cle], e, b, p.keywords);
      const taux = r.ok && r.cost != null ? Math.round(100 * r.cost / b) : null;
      out.previsions.push({
        fenetre: PERIODE_JUIN.cle, zone: zoneLarge.cle, perimetre: p.cle, enchere: e.cle,
        budget_mensuel: b, taux_de_depense_pct: taux, geo_cibles: zoneGeoUtilise[zoneLarge.cle].length, ...r,
      });
      console.log(r.ok
        ? `  ${p.cle.padEnd(5)} ${String(b).padStart(4)} EUR -> ${String(r.cost?.toFixed(2)).padStart(8)} EUR (${String(taux).padStart(3)}%) · ${String(r.clicks?.toFixed(0)).padStart(4)} clics · CPC ${r.cpc?.toFixed(2) ?? "--"}`
        : `  ${p.cle.padEnd(5)} ${String(b).padStart(4)} EUR -> ERREUR ${r.error}`);
      save();
      await sleep(7_000);
    }
  }
}

/* ── Objectif 500 EUR de depense reelle ──────────────────────────────────── */
console.log(`\n########## objectif 500 EUR de depense mensuelle reelle ##########`);
const atteint = [];
for (const z of ZONES) for (const p of PERIMETRES) for (const e of ENCHERES) {
  const serie = out.previsions
    .filter((x) => x.fenetre === PERIODE_SEPT.cle && x.zone === z.cle && x.perimetre === p.cle && x.enchere === e.cle && x.ok)
    .sort((a, b) => a.budget_mensuel - b.budget_mensuel);
  if (!serie.length) continue;
  const ok = serie.find((x) => x.cost >= 500);
  const plafond = Math.max(...serie.map((x) => x.cost));
  const ligne = {
    zone: z.cle, perimetre: p.cle, enchere: e.cle,
    atteint_500: !!ok,
    budget_demande_min: ok?.budget_mensuel ?? null,
    depense_max_mesuree: +plafond.toFixed(2),
    clics_au_max: Math.round(serie.find((x) => x.cost === plafond)?.clicks ?? 0),
    cpc_au_max: +(serie.find((x) => x.cost === plafond)?.cpc ?? 0).toFixed(2),
  };
  atteint.push(ligne);
}
out.objectif_500 = atteint;
atteint.filter((a) => a.atteint_500).forEach((a) =>
  console.log(`  ATTEINT  ${a.zone.padEnd(20)} ${a.perimetre.padEnd(5)} ${a.enchere.padEnd(9)} des ${a.budget_demande_min} EUR demandes`));
const meilleurs = atteint.filter((a) => !a.atteint_500).sort((a, b) => b.depense_max_mesuree - a.depense_max_mesuree).slice(0, 6);
meilleurs.forEach((a) =>
  console.log(`  plafond  ${a.zone.padEnd(20)} ${a.perimetre.padEnd(5)} ${a.enchere.padEnd(9)} -> ${String(a.depense_max_mesuree).padStart(8)} EUR max · ${String(a.clics_au_max).padStart(4)} clics · CPC ${a.cpc_au_max}`));

console.log(`\nprevisions : ${out.previsions.length} · erreurs : ${out.errors.length}`);
console.log(`ecrit -> ${OUT}`);
save();
