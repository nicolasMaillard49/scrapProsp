import { readFileSync } from "node:fs";
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const h = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` };
const res = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/eligibilite_leads?select=ref,created_at,status,metier,ville,email,phone,site_url,budget_daily&order=created_at.desc&limit=20`,
  { headers: h },
);
const rows = await res.json();
console.log(`${rows.length} derniers leads eligibilite_leads:\n`);
for (const r of rows) {
  console.log(`#${r.ref}  ${r.created_at?.slice(0,16)}  status=${r.status}  ${r.metier||"-"}/${r.ville||"-"}  ${r.email||"-"}  ${r.phone||"-"}  budget=${r.budget_daily ?? "-"}  site=${r.site_url||"-"}`);
}
