// Crée/Met à jour un lead de DÉMO dans eligibilite_leads, pour que la console
// /admin/funnel ait toujours un exemple affichable (formulaire + rapport + emails).
// Usage: node scripts/seed-demo-lead.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const DEMO = {
  id: "11111111-1111-4111-8111-111111111111",
  token: "demo",
  metier: "plombier",
  ville: "Tours",
  lat: 47.3941,
  lon: 0.6848,
  radius_km: 15,
  site_url: "https://exemple-plomberie-tours.fr",
  employees_range: "2_5",
  ca_range: "15k_50k",
  ad_budget_range: "lt_500",
  goal_range: "plus_50",
  first_name: "Jean",
  last_name: "Dupont",
  email: "jean.dupont@exemple.fr",
  phone: "06 15 90 78 73",
  service_cible: "Débouchage canalisation urgence",
  service_reason: "Forte intention commerciale et recherches urgentes sur votre zone.",
  budget_daily: 25,
  budget_monthly: 760,
  calls_per_month: 56,
  revenue_month: 3920,
  score: 8,
  status: "report_viewed",
};

const { error } = await sb.from("eligibilite_leads").upsert(DEMO, { onConflict: "id" });
if (error) {
  console.error("Seed démo échoué:", error.message);
  process.exit(1);
}
console.log("✓ Lead de démo prêt — token:", DEMO.token, "· id:", DEMO.id);
console.log("  /eligibilite/demo  ·  /eligibilite/rapport/" + DEMO.id);
