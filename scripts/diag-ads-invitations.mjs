/**
 * DIAGNOSTIC (lecture seule) — état réel des comptes Google Ads créés et
 * du résultat d'invitation (payload.invited). Aide à trancher : email
 * réellement envoyé ? erreur avalée ? email vide ?
 *
 * Usage: node scripts/diag-ads-invitations.mjs
 */
import { readFileSync } from "node:fs";

// Charge .env.local sans dépendance
const env = {};
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch (e) {
  console.error("Impossible de lire .env.local:", e.message);
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY manquant.");
  process.exit(1);
}

const res = await fetch(
  `${url}/rest/v1/google_ads_accounts?select=id,created_at,client_name,status,customer_id,campaign_id,error,payload,lead_id&order=created_at.desc&limit=15`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  console.error("Erreur REST", res.status, await res.text());
  process.exit(1);
}
const rows = await res.json();
console.log(`\n${rows.length} dernières lignes google_ads_accounts:\n`);
for (const r of rows) {
  const invited = r.payload && typeof r.payload === "object" ? r.payload.invited : undefined;
  console.log(
    [
      `• ${r.created_at?.slice(0, 19)}`,
      `status=${r.status}`,
      `customer_id=${r.customer_id || "-"}`,
      `campaign_id=${r.campaign_id || "-"}`,
      `invited=${invited === undefined ? "(absent du payload)" : invited}`,
      r.error ? `error=${r.error}` : "",
    ]
      .filter(Boolean)
      .join("  |  "),
  );
}
