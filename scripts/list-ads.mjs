// Lecture seule : liste les comptes/campagnes Google Ads suivis en base.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const { data, error } = await sb
  .from("google_ads_accounts")
  .select("id, client_name, customer_id, campaign_id, budget_id, status, daily_budget, metier, ville, created_at")
  .order("created_at", { ascending: false });
if (error) { console.error(error.message); process.exit(1); }
const byStatus = {};
for (const r of data) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
console.log(`${data.length} lignes. Par statut:`, byStatus);
const real = data.filter((r) => r.campaign_id);
console.log(`\nVraies campagnes (campaign_id non nul): ${real.length}`);
for (const r of real) {
  console.log(`  • ${r.client_name} [${r.status}] cust=${r.customer_id} camp=${r.campaign_id} budget=${r.budget_id} ${r.daily_budget ?? "?"}€/j (${r.created_at?.slice(0,10)})`);
}
