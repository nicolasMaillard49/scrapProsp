// Crée un prospect de TEST « testest » (table prospects) + son lead d'éligibilité
// (eligibilite_leads) avec TON email, pour dérouler le vrai parcours Google Ads
// jusqu'à l'email d'invitation. Idempotent (upsert par id / dédup maps_url).
// Usage: node scripts/seed-test-prospect.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const EMAIL = "nico39320@gmail.com"; // doit être dans GOOGLE_ADS_REAL_EMAILS
const PHONE = "0615907873";
const MAPS_URL = "manual:testest"; // clé de dédup stable pour le prospect de test

// 1) Prospect dans le tracker
const { data: existing } = await sb.from("prospects").select("id").eq("maps_url", MAPS_URL).limit(1).maybeSingle();
if (!existing) {
  const { error } = await sb.from("prospects").insert({
    name: "testest",
    metier: "plombier",
    phone: PHONE,
    ville: "Angers",
    departement: "49",
    region: "pays-de-la-loire",
    region_label: "Pays de la Loire",
    rating: null,
    reviews: null,
    address: "Angers",
    website: null,
    maps_url: MAPS_URL,
    source: "manuel",
    status: "todo",
    notes: "Prospect de TEST (funnel Google Ads).",
  });
  if (error) {
    console.error("Insert prospect échoué:", error.message);
    process.exit(1);
  }
  console.log("✓ Prospect « testest » créé (tracker).");
} else {
  console.log("• Prospect « testest » déjà présent (id:", existing.id + ").");
}

// 2) Lead d'éligibilité (ce que le funnel/launch utilise réellement)
const LEAD = {
  id: "7e57e57e-7e57-4e57-8e57-7e577e577e57", // "testest" en leet, UUID v4 valide
  token: "testest",
  metier: "plombier",
  ville: "Angers",
  lat: 47.4784,
  lon: -0.5632,
  radius_km: 15,
  site_url: "https://plomberie-testest.fr",
  employees_range: "2_5",
  ca_range: "15k_50k",
  ad_budget_range: "lt_500",
  goal_range: "plus_50",
  first_name: "Testest",
  last_name: "",
  email: EMAIL,
  phone: PHONE,
  service_cible: "Débouchage canalisation urgence",
  service_reason: "Forte intention commerciale sur la zone.",
  budget_daily: 12,
  budget_monthly: 360,
  calls_per_month: 27,
  revenue_month: 1890,
  score: 6,
  status: "report_viewed",
};
const { error } = await sb.from("eligibilite_leads").upsert(LEAD, { onConflict: "id" });
if (error) {
  console.error("Upsert lead échoué:", error.message);
  process.exit(1);
}
console.log("✓ Lead d'éligibilité prêt — token:", LEAD.token, "· id:", LEAD.id, "· email:", EMAIL);
console.log("  Rapport : /eligibilite/rapport/" + LEAD.id);
console.log("  → clique « Lancer ma campagne » pour déclencher la création réelle (email dans l'allow-list).");
