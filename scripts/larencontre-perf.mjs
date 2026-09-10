/**
 * La Rencontre — releve de performance de la campagne, en LECTURE SEULE.
 *
 * Rien n'est cree, modifie ni mis en pause cote Google. Le script interroge le
 * compte client 404-054-1764 sous le MCC et ecrit un JSON date dans le dossier
 * d'audit, plus un rapport lisible sur la sortie standard.
 *
 * Huit passes :
 *   1. campagne, jour par jour, avec les parts d'impressions
 *   2. groupes d'annonces
 *   3. mots cles (type de correspondance et Quality Score)
 *   4. TERMES DE RECHERCHE — la passe qui compte a J+1
 *   5. repartition horaire (controle du calendrier 17h-22h)
 *   6. annonces : etat, approbation, force
 *   7. conversions par action
 *   8. exclusions deja en place
 *
 *   cd C:/Users/n.maillard/VueJS/scrapProsp
 *   node --import tsx scripts/larencontre-perf.mjs [AAAA-MM-JJ debut] [AAAA-MM-JJ fin]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

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

const { clientCustomer, MCC_ID } = await import("../app/lib/googleAds/client.ts");

const CUSTOMER = "4040541764";
const CAMPAIGN = "24197703801";
const OUT_DIR = "C:/Users/n.maillard/audit-nmf/la-rencontre/data";

const today = new Date().toISOString().slice(0, 10);
const START = process.argv[2] || "2026-09-03";
const END = process.argv[3] || today;

const cust = clientCustomer(CUSTOMER);
const euros = (m) => Number(m || 0) / 1e6;
const pct = (x) => (x === undefined || x === null ? null : Number(x) * 100);

const q = async (gaql, label) => {
  try {
    const rows = await cust.query(gaql);
    console.log(`  . ${label} : ${rows.length} ligne(s)`);
    return rows;
  } catch (e) {
    const msg = e?.errors?.[0]?.message || e?.message || String(e);
    console.error(`  ! ${label} : ${msg}`);
    return { erreur: msg };
  }
};

const M = `metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc,
  metrics.cost_micros, metrics.conversions, metrics.conversions_value,
  metrics.all_conversions`;
const PERIODE = `segments.date BETWEEN '${START}' AND '${END}'`;

console.log(`\n=== La Rencontre — compte ${CUSTOMER}, MCC ${MCC_ID} ===`);
console.log(`Periode : ${START} -> ${END}\n`);

const out = {
  meta: {
    client: "Restaurant La Rencontre",
    customer: CUSTOMER,
    campaign: CAMPAIGN,
    mcc: MCC_ID,
    extraction: new Date().toISOString(),
    periode: { start: START, end: END },
  },
};

/* 1. campagne, jour par jour */
out.campagne = await q(`
  SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
         campaign_budget.amount_micros, campaign.bidding_strategy_type,
         segments.date, ${M},
         metrics.search_impression_share, metrics.search_budget_lost_impression_share,
         metrics.search_rank_lost_impression_share, metrics.search_top_impression_share
  FROM campaign
  WHERE campaign.id = ${CAMPAIGN} AND ${PERIODE}
  ORDER BY segments.date`, "campagne par jour");

/* 2. groupes d'annonces */
out.groupes = await q(`
  SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.cpc_bid_micros, ${M}
  FROM ad_group
  WHERE campaign.id = ${CAMPAIGN} AND ${PERIODE}`, "groupes d'annonces");

/* 3. mots cles */
out.motsCles = await q(`
  SELECT ad_group.name, ad_group_criterion.keyword.text,
         ad_group_criterion.keyword.match_type, ad_group_criterion.status,
         ad_group_criterion.quality_info.quality_score, ${M}
  FROM keyword_view
  WHERE campaign.id = ${CAMPAIGN} AND ${PERIODE} AND metrics.impressions > 0
  ORDER BY metrics.impressions DESC`, "mots cles avec impressions");

/* 4. termes de recherche — la passe qui compte */
out.termes = await q(`
  SELECT search_term_view.search_term, search_term_view.status, ad_group.name,
         segments.keyword.info.text, segments.keyword.info.match_type, ${M}
  FROM search_term_view
  WHERE campaign.id = ${CAMPAIGN} AND ${PERIODE}
  ORDER BY metrics.cost_micros DESC`, "TERMES DE RECHERCHE");

/* 5. repartition horaire — controle du calendrier 17h-22h */
out.horaire = await q(`
  SELECT segments.hour, segments.day_of_week, ${M}
  FROM campaign
  WHERE campaign.id = ${CAMPAIGN} AND ${PERIODE}
  ORDER BY segments.hour`, "repartition horaire");

/* 6. annonces */
out.annonces = await q(`
  SELECT ad_group.name, ad_group_ad.ad.id, ad_group_ad.status,
         ad_group_ad.policy_summary.approval_status,
         ad_group_ad.ad_strength,
         ad_group_ad.ad.final_urls, ${M}
  FROM ad_group_ad
  WHERE campaign.id = ${CAMPAIGN} AND ${PERIODE}`, "annonces");

/* 7. conversions par action */
out.conversions = await q(`
  SELECT segments.conversion_action_name, segments.conversion_action_category,
         metrics.conversions, metrics.all_conversions, metrics.conversions_value
  FROM campaign
  WHERE campaign.id = ${CAMPAIGN} AND ${PERIODE} AND metrics.all_conversions > 0`,
  "conversions par action");

/* 8. exclusions en place, pour situer ce qu'il reste a exclure */
out.exclusions = await q(`
  SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
  FROM campaign_criterion
  WHERE campaign.id = ${CAMPAIGN} AND campaign_criterion.negative = TRUE
    AND campaign_criterion.type = 'KEYWORD'`, "exclusions campagne");

mkdirSync(OUT_DIR, { recursive: true });
const OUT = `${OUT_DIR}/perf-${today}.json`;
writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

/* -- Rapport lisible ------------------------------------------------------- */
const tot = (rows) => (Array.isArray(rows) ? rows : []).reduce((a, r) => {
  a.impr += Number(r.metrics?.impressions || 0);
  a.clics += Number(r.metrics?.clicks || 0);
  a.cout += euros(r.metrics?.cost_micros);
  a.conv += Number(r.metrics?.conversions || 0);
  a.allConv += Number(r.metrics?.all_conversions || 0);
  return a;
}, { impr: 0, clics: 0, cout: 0, conv: 0, allConv: 0 });

const eur = (x) => `${x.toFixed(2)} EUR`;
const ligne = (l, t) => `${String(l).padEnd(30)} ${String(t.impr).padStart(6)} ${String(t.clics).padStart(6)} ` +
  `${(t.impr ? (t.clics / t.impr) * 100 : 0).toFixed(2).padStart(6)}% ` +
  `${(t.clics ? t.cout / t.clics : 0).toFixed(2).padStart(6)} ${eur(t.cout).padStart(11)}`;

console.log(`\n--- Cumul campagne ${START} -> ${END} ---`);
console.log(`${"".padEnd(30)} ${"Impr".padStart(6)} ${"Clics".padStart(6)} ${"CTR".padStart(7)} ${"CPC".padStart(6)} ${"Cout".padStart(11)}`);
const T = tot(out.campagne);
console.log(ligne("CAMPAGNE", T));
console.log(`Conversions : ${T.conv} (toutes : ${T.allConv})`);

if (Array.isArray(out.campagne) && out.campagne.length) {
  console.log(`\n--- Jour par jour ---`);
  for (const r of out.campagne) {
    console.log(ligne(r.segments.date, tot([r])) +
      `  IS ${pct(r.metrics?.search_impression_share)?.toFixed(1) ?? "n/d"}%` +
      ` . perdu budget ${pct(r.metrics?.search_budget_lost_impression_share)?.toFixed(1) ?? "n/d"}%` +
      ` . perdu rang ${pct(r.metrics?.search_rank_lost_impression_share)?.toFixed(1) ?? "n/d"}%`);
  }
}

if (Array.isArray(out.groupes)) {
  console.log(`\n--- Groupes ---`);
  for (const r of out.groupes) console.log(ligne(r.ad_group.name, tot([r])));
}

if (Array.isArray(out.termes)) {
  console.log(`\n--- Termes de recherche (${out.termes.length}) ---`);
  for (const r of out.termes) {
    const t = tot([r]);
    console.log(`${String(r.search_term_view.search_term || "").slice(0, 44).padEnd(45)}` +
      `${String(t.impr).padStart(5)} impr ${String(t.clics).padStart(3)} clic ${eur(t.cout).padStart(10)}` +
      `   << ${r.segments?.keyword?.info?.text || "?"}`);
  }
}

if (Array.isArray(out.motsCles)) {
  console.log(`\n--- Mots cles avec impressions (${out.motsCles.length}) ---`);
  for (const r of out.motsCles) {
    const t = tot([r]);
    console.log(`${String(r.ad_group_criterion.keyword.text || "").slice(0, 38).padEnd(39)}` +
      `${String(r.ad_group_criterion.keyword.match_type).padEnd(9)}` +
      `${String(t.impr).padStart(5)} impr ${String(t.clics).padStart(3)} clic ${eur(t.cout).padStart(10)}` +
      `  QS ${r.ad_group_criterion.quality_info?.quality_score ?? "n/d"}`);
  }
}

if (Array.isArray(out.horaire)) {
  console.log(`\n--- Heures ---`);
  for (const r of out.horaire) {
    const t = tot([r]);
    if (!t.impr) continue;
    console.log(`${String(r.segments.hour).padStart(2)}h  ${String(t.impr).padStart(5)} impr ${String(t.clics).padStart(3)} clic ${eur(t.cout).padStart(10)}`);
  }
}

if (Array.isArray(out.annonces)) {
  console.log(`\n--- Annonces ---`);
  for (const r of out.annonces) {
    console.log(`${String(r.ad_group.name).padEnd(22)} ${String(r.ad_group_ad.status).padEnd(10)} ` +
      `${String(r.ad_group_ad.policy_summary?.approval_status).padEnd(12)} force ${r.ad_group_ad.ad_strength}`);
  }
}

if (Array.isArray(out.conversions)) {
  console.log(`\n--- Conversions par action ---`);
  if (!out.conversions.length) console.log("aucune conversion sur la periode");
  for (const r of out.conversions) {
    console.log(`${String(r.segments.conversion_action_name).padEnd(34)} ${r.metrics.conversions} (toutes ${r.metrics.all_conversions})`);
  }
}

console.log(`\nExclusions en place : ${Array.isArray(out.exclusions) ? out.exclusions.length : "n/d"}`);
console.log(`Ecrit : ${OUT}`);
