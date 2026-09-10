/**
 * La Rencontre — controle du SUIVI DES CONVERSIONS et de l'etat des composants,
 * en LECTURE SEULE. Rien n'est ecrit cote Google.
 *
 *   1. reglage de suivi du compte (customer.conversion_tracking_setting)
 *   2. actions de conversion : statut, principale/secondaire, comptage, fenetre
 *   3. objectifs de conversion de la campagne et du compte
 *   4. recommandations Google ouvertes sur le compte (dont le suivi des conversions)
 *   5. annonces : approbation apres le changement d'URL du 07/09
 *   6. composants Image poses le 07/09 : examen et diffusion
 *
 *   cd C:/Users/n.maillard/VueJS/scrapProsp
 *   node --import tsx scripts/larencontre-suivi-conversions.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

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
loadEnv("C:/Users/n.maillard/Obsidian/Cerveau/Credentials.md", (k) => k.startsWith("GOOGLE_ADS_"));

const { clientCustomer } = await import("../app/lib/googleAds/client.ts");

const CUSTOMER = "4040541764";
const CAMPAIGN = "24197703801";
const OUT_DIR = "C:/Users/n.maillard/audit-nmf/la-rencontre/data";
const today = new Date().toISOString().slice(0, 10);
const cust = clientCustomer(CUSTOMER);

const q = async (gaql, label) => {
  try { const rows = await cust.query(gaql); console.log(`  . ${label} : ${rows.length}`); return rows; }
  catch (e) { const msg = e?.errors?.[0]?.message || e?.message || String(e); console.error(`  ! ${label} : ${msg}`); return { erreur: msg }; }
};

const out = { meta: { customer: CUSTOMER, campaign: CAMPAIGN, extraction: new Date().toISOString() } };

out.compte = await q(`
  SELECT customer.id, customer.descriptive_name, customer.status,
         customer.conversion_tracking_setting.conversion_tracking_id,
         customer.conversion_tracking_setting.conversion_tracking_status,
         customer.conversion_tracking_setting.google_ads_conversion_customer,
         customer.conversion_tracking_setting.accepted_customer_data_terms,
         customer.conversion_tracking_setting.enhanced_conversions_for_leads_enabled,
         customer.conversion_tracking_setting.cross_account_conversion_tracking_id
  FROM customer`, "compte");

out.actions = await q(`
  SELECT conversion_action.id, conversion_action.name, conversion_action.status,
         conversion_action.type, conversion_action.category, conversion_action.origin,
         conversion_action.primary_for_goal, conversion_action.include_in_conversions_metric,
         conversion_action.counting_type, conversion_action.click_through_lookback_window_days,
         conversion_action.attribution_model_settings.attribution_model,
         metrics.all_conversions, metrics.conversions
  FROM conversion_action
  WHERE segments.date DURING LAST_30_DAYS`, "actions de conversion (30 j)");

out.actionsToutes = await q(`
  SELECT conversion_action.id, conversion_action.name, conversion_action.status,
         conversion_action.type, conversion_action.category, conversion_action.origin,
         conversion_action.primary_for_goal, conversion_action.include_in_conversions_metric,
         conversion_action.counting_type, conversion_action.click_through_lookback_window_days,
         conversion_action.attribution_model_settings.attribution_model
  FROM conversion_action`, "actions de conversion (toutes)");

out.objectifsCampagne = await q(`
  SELECT campaign.id, campaign_conversion_goal.category, campaign_conversion_goal.origin,
         campaign_conversion_goal.biddable
  FROM campaign_conversion_goal
  WHERE campaign.id = ${CAMPAIGN}`, "objectifs de conversion campagne");

out.objectifsCompte = await q(`
  SELECT customer_conversion_goal.category, customer_conversion_goal.origin,
         customer_conversion_goal.biddable
  FROM customer_conversion_goal`, "objectifs de conversion compte");

out.campagne = await q(`
  SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type,
         campaign.primary_status, campaign.primary_status_reasons,
         campaign.maximize_clicks.cpc_bid_ceiling_micros,
         campaign_budget.amount_micros
  FROM campaign WHERE campaign.id = ${CAMPAIGN}`, "campagne");

out.recommandations = await q(`
  SELECT recommendation.type, recommendation.resource_name, recommendation.campaign,
         recommendation.dismissed
  FROM recommendation`, "recommandations");

out.annonces = await q(`
  SELECT ad_group.name, ad_group_ad.ad.id, ad_group_ad.status,
         ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status,
         ad_group_ad.policy_summary.policy_topic_entries, ad_group_ad.ad_strength,
         ad_group_ad.ad.final_urls
  FROM ad_group_ad WHERE campaign.id = ${CAMPAIGN}`, "annonces");

out.imagesEtat = await q(`
  SELECT campaign.id, asset.id, asset.name, asset.policy_summary.approval_status,
         asset.policy_summary.review_status, asset.policy_summary.policy_topic_entries,
         campaign_asset.status, campaign_asset.primary_status, campaign_asset.primary_status_reasons
  FROM campaign_asset
  WHERE campaign.id = ${CAMPAIGN} AND campaign_asset.field_type = 'AD_IMAGE'`, "images (etat)");

out.images = await q(`
  SELECT campaign.id, asset.id, asset.name, campaign_asset.field_type,
         metrics.impressions, metrics.clicks, metrics.cost_micros
  FROM campaign_asset
  WHERE campaign.id = ${CAMPAIGN} AND campaign_asset.field_type = 'AD_IMAGE'
    AND segments.date DURING LAST_14_DAYS`, "images (metriques 14 j)");

out.composantsCampagne = await q(`
  SELECT campaign.id, campaign_asset.field_type, campaign_asset.status,
         campaign_asset.primary_status, asset.id, asset.name, asset.type
  FROM campaign_asset WHERE campaign.id = ${CAMPAIGN}`, "tous composants campagne");

mkdirSync(OUT_DIR, { recursive: true });
const OUT = `${OUT_DIR}/suivi-conversions-${today}.json`;
writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

const arr = (x) => (Array.isArray(x) ? x : []);
console.log("\n--- Compte ---");
console.log(JSON.stringify(out.compte?.[0]?.customer ?? out.compte, null, 1));
console.log("\n--- Actions de conversion ---");
for (const r of arr(out.actionsToutes)) {
  const a = r.conversion_action;
  console.log(`${String(a.name).padEnd(46)} statut ${a.status} type ${a.type} cat ${a.category} origine ${a.origin} principale ${a.primary_for_goal} inclus ${a.include_in_conversions_metric} comptage ${a.counting_type} fenetre ${a.click_through_lookback_window_days}j attrib ${a.attribution_model_settings?.attribution_model}`);
}
console.log("\n--- Conversions 30 j par action ---");
for (const r of arr(out.actions)) console.log(`${String(r.conversion_action.name).padEnd(46)} conv ${r.metrics.conversions} toutes ${r.metrics.all_conversions}`);
console.log("\n--- Objectifs campagne ---"); console.log(JSON.stringify(out.objectifsCampagne));
console.log("\n--- Objectifs compte ---"); console.log(JSON.stringify(out.objectifsCompte));
console.log("\n--- Campagne ---"); console.log(JSON.stringify(out.campagne));
console.log("\n--- Recommandations ---");
for (const r of arr(out.recommandations)) console.log(`${r.recommendation.type}  ${r.recommendation.campaign || ""}  dismissed=${r.recommendation.dismissed}`);
console.log("\n--- Annonces ---");
for (const r of arr(out.annonces)) console.log(`${String(r.ad_group.name).padEnd(20)} ${r.ad_group_ad.status} ${r.ad_group_ad.policy_summary?.approval_status} review ${r.ad_group_ad.policy_summary?.review_status} force ${r.ad_group_ad.ad_strength} ${r.ad_group_ad.ad.final_urls} topics ${JSON.stringify(r.ad_group_ad.policy_summary?.policy_topic_entries || [])}`);
console.log("\n--- Images ---");
for (const r of arr(out.imagesEtat)) console.log(`${String(r.asset.name).padEnd(44)} ${r.asset.policy_summary?.approval_status} review ${r.asset.policy_summary?.review_status} lien ${r.campaign_asset.status} primaire ${r.campaign_asset.primary_status} ${JSON.stringify(r.campaign_asset.primary_status_reasons || [])} topics ${JSON.stringify(r.asset.policy_summary?.policy_topic_entries || [])}`);
for (const r of arr(out.images)) console.log(`  ${String(r.asset.name).padEnd(42)} impr ${r.metrics.impressions} clics ${r.metrics.clicks}`);
console.log("\n--- Tous composants ---");
for (const r of arr(out.composantsCampagne)) console.log(`${String(r.campaign_asset.field_type).padEnd(20)} ${r.campaign_asset.status} ${r.campaign_asset.primary_status} ${r.asset.name || r.asset.id}`);
console.log(`\nEcrit : ${OUT}`);
