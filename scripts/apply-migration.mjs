// Applique un fichier de migration SQL à Supabase via la connection string Postgres.
// Usage: node scripts/apply-migration.mjs supabase/migration-012-google-ads.sql
import { readFileSync } from "fs";
import pg from "pg";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <fichier.sql>");
  process.exit(1);
}
const sql = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
await c.query(sql);
console.log(`✓ Migration appliquée: ${file}`);
await c.end();
