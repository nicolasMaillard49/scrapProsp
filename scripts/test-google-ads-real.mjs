// Création RÉELLE Google Ads sur un lead — crée vraiment un sous-compte sous le
// MCC 671 + invitation + campagne PAUSED. À UTILISER AVEC PRÉCAUTION.
// Usage (tsx requis pour importer les modules TS) :
//   node --import tsx scripts/test-google-ads-real.mjs           -> lead test "testest"
//   node --import tsx scripts/test-google-ads-real.mjs <leadId>  -> lead réel depuis Supabase
//
// N'envoie AUCUN email (contrairement à /api/eligibilite/launch) : isole la
// création Google Ads pour diagnostiquer la vraie erreur API.

import { readFileSync } from "fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
}

const DEFAULT_LEAD_ID = "7e57e57e-7e57-4e57-8e57-7e577e577e57"; // lead "testest" (allow-listé)
const leadId = process.argv[2] || DEFAULT_LEAD_ID;

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const { data: lead, error } = await sb.from("eligibilite_leads").select("*").eq("id", leadId).single();
if (error || !lead) {
  console.error("Lead introuvable:", error?.message);
  process.exit(1);
}

const { isRealAllowed } = await import("../app/lib/googleAds/allowlist.ts");
const { googleAdsConfigured, MCC_ID } = await import("../app/lib/googleAds/client.ts");

console.log("Lead:", lead.id, "|", lead.metier, lead.ville, "| email:", lead.email);
console.log("MCC:", MCC_ID, "| credentials OK:", googleAdsConfigured());
console.log("email allow-listé:", isRealAllowed(lead.email), `(GOOGLE_ADS_REAL_EMAILS=${process.env.GOOGLE_ADS_REAL_EMAILS || "—"})`);

if (!googleAdsConfigured()) {
  console.error("\n❌ Credentials Google Ads incomplets dans .env.local — abandon.");
  process.exit(1);
}

console.log("\n=== CRÉATION RÉELLE (createCampaignForLead dryRun:false) ===");
const { createCampaignForLead } = await import("../app/lib/googleAds/campaign.ts");
const res = await createCampaignForLead(lead, { dryRun: false });

console.log("\n--- RÉSULTAT ---");
console.log("ok:", res.ok);
console.log("dryRun:", res.dryRun);
console.log("customerId:", res.customerId ?? "—");
console.log("campaignId:", res.campaignId ?? "—");
console.log("recordId:", res.recordId ?? "—");
if (res.error) console.log("ERREUR:", res.error);
if (res.plan?.warnings?.length) console.log("warnings:", res.plan.warnings);
process.exit(res.ok ? 0 : 2);
