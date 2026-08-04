/**
 * DIAGNOSTIC (lecture seule) — vérifie la complétude du dernier lead "lancé" :
 * payload du plan persisté + champs critiques du lead (géo, site_url, tél, budget).
 * Usage: node scripts/diag-lead-readiness.mjs
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

// 1) Dernière ligne ads (toutes status) avec payload + lead_id
const adsRes = await fetch(
  `${url}/rest/v1/google_ads_accounts?select=created_at,status,error,payload,lead_id&order=created_at.desc&limit=1`,
  { headers: h },
);
const [ads] = await adsRes.json();
console.log("=== Dernière ligne google_ads_accounts ===");
console.log("created_at:", ads.created_at, "| status:", ads.status, "| lead_id:", ads.lead_id);
const plan = ads.payload && typeof ads.payload === "object" ? ads.payload : null;
if (plan?.params) {
  const p = plan.params;
  console.log("\n--- PLAN persisté (payload) ---");
  console.log("accountName :", p.accountName);
  console.log("campaignName:", p.campaignName);
  console.log("budget €/j  :", Math.round((p.dailyBudgetMicros || 0) / 1e6));
  console.log("geo         :", JSON.stringify(p.geo));
  console.log("finalUrl    :", p.finalUrl || "(VIDE ⚠️)");
  console.log("callPhone   :", p.callPhoneE164 || "(VIDE ⚠️)");
  console.log("bidding     :", p.biddingStrategy);
  console.log("keywords    :", (plan.keywords || []).length, "| negatives:", (plan.negatives || []).length);
  console.log("RSA headlines:", (plan.ad?.headlines || []).length, "| descriptions:", (plan.ad?.descriptions || []).length);
  console.log("copySource  :", plan.copySource);
  console.log("warnings    :", JSON.stringify(plan.warnings || []));
} else {
  console.log("⚠️ payload sans .params :", JSON.stringify(plan)?.slice(0, 300));
}

// 2) Le lead source : champs critiques bruts
if (ads.lead_id) {
  const leadRes = await fetch(
    `${url}/rest/v1/eligibilite_leads?select=id,ref,status,metier,ville,lat,lon,radius_km,site_url,phone,email,budget_daily,ad_budget_range&id=eq.${ads.lead_id}`,
    { headers: h },
  );
  const [lead] = await leadRes.json();
  console.log("\n=== Lead source (eligibilite_leads) ===");
  if (lead) {
    for (const k of ["ref","status","metier","ville","lat","lon","radius_km","site_url","phone","email","budget_daily","ad_budget_range"]) {
      const v = lead[k];
      const flag = (k === "site_url" && !v) ? "  ⚠️ VIDE (RSA refusée sans final URL)"
        : ((k === "lat" || k === "lon") && (v === null || v === undefined)) ? "  ⚠️ pas de géo proximité"
        : "";
      console.log(`${k.padEnd(15)}: ${v ?? "(null)"}${flag}`);
    }
  } else {
    console.log("⚠️ lead introuvable pour id", ads.lead_id);
  }
}
