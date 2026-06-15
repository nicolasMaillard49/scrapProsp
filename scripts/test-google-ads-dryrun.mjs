// Dry-run Google Ads sur un lead — construit et affiche le plan SANS rien créer.
// Usage (tsx requis pour importer les modules TS) :
//   node --import tsx scripts/test-google-ads-dryrun.mjs           -> lead factice (plombier Tours)
//   node --import tsx scripts/test-google-ads-dryrun.mjs <leadId>  -> lead réel depuis Supabase
//
// Charge .env.local pour ANTHROPIC_API_KEY (sinon fallback rule-based) et Supabase.

import { readFileSync } from "fs";

// Charge .env.local dans process.env
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
}

const { leadToCampaignParams } = await import("../app/lib/googleAds/mapping.ts");
const { buildPlan } = await import("../app/lib/googleAds/campaign.ts");

// Lead factice = celui documenté dans la note (plombier Tours, débouchage urgence).
const fakeLead = {
  id: "test-local",
  metier: "plombier",
  ville: "Tours",
  lat: 47.3941,
  lon: 0.6848,
  radius_km: 15,
  site_url: "exemple-plomberie-tours.fr",
  service_cible: "Débouchage canalisation urgence",
  budget_daily: 25,
  ad_budget_range: "lt_500",
  first_name: "Jean",
  last_name: "Dupont",
  phone: "06 15 90 78 73",
};

let lead = fakeLead;
const leadId = process.argv[2];
if (leadId) {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
  const { data, error } = await sb.from("eligibilite_leads").select("*").eq("id", leadId).single();
  if (error || !data) {
    console.error("Lead introuvable:", error?.message);
    process.exit(1);
  }
  lead = data;
}

console.log("=== PARAMS (mapping pur) ===");
console.log(JSON.stringify(leadToCampaignParams(lead), null, 2));

console.log("\n=== PLAN COMPLET (buildPlan) ===");
const plan = await buildPlan(lead);
console.log("copySource:", plan.copySource);
console.log("warnings:", plan.warnings);
console.log("budget €/j:", Math.round(plan.params.dailyBudgetMicros / 1_000_000), "| cap 7j:", plan.capEuros ?? plan.params.capEuros, "€");
console.log("keywords:", plan.keywords.length, "->", plan.keywords.slice(0, 6).map((k) => `${k.text} [${k.match}]`));
console.log("négatifs:", plan.negatives.length);
console.log("titres RSA:", plan.ad.headlines.length, plan.ad.headlines);
console.log("descriptions RSA:", plan.ad.descriptions.length, plan.ad.descriptions);
console.log("call tracking:", plan.callTracking);

// Avec un leadId réel : teste aussi la persistance (insert ligne dry_run).
if (leadId) {
  const { createCampaignForLead } = await import("../app/lib/googleAds/campaign.ts");
  const res = await createCampaignForLead(lead, { dryRun: true });
  console.log("\n=== PERSISTANCE (createCampaignForLead dry-run) ===");
  console.log("ok:", res.ok, "| dryRun:", res.dryRun, "| recordId:", res.recordId);
}
