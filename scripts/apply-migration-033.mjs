// Applique supabase/migration-033-documents.sql ET crée le bucket de stockage
// `crm` (privé) qui portera les fichiers.
//
// Le bucket ne se crée pas en SQL : c'est une ressource Storage, appelée via
// l'API d'administration avec la clé secrète.
//
// Usage : node scripts/apply-migration-033.mjs

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (!(key in process.env)) process.env[key] = t.slice(eq + 1).trim();
  }
}
loadEnvLocal();

const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ SUPABASE_DB_URL manquant dans .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("✓ Connecté à Postgres");

  await client.query(readFileSync(resolve(ROOT, "supabase", "migration-033-documents.sql"), "utf-8"));
  console.log("✓ migration-033-documents.sql appliquée");

  const { rows: tbl } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'client_documents'`,
  );
  console.log(tbl.length ? "  table client_documents ✓" : "  ❌ table absente");
  if (!tbl.length) process.exit(1);

  // Le bucket : créé via l'API Storage, en PRIVÉ. Un audit nomme des chiffres
  // d'affaires — une URL publique devinable suffirait à les exposer.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("  ⚠️ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY manquants — bucket non créé");
  } else {
    const res = await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ id: "crm", name: "crm", public: false, file_size_limit: 26_214_400 }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) console.log("  bucket « crm » créé (privé, 25 Mo max) ✓");
    else if (/already exists|Duplicate/i.test(JSON.stringify(j))) console.log("  bucket « crm » déjà présent ✓");
    else console.log(`  ⚠️ bucket non créé : ${JSON.stringify(j)}`);
  }
} catch (e) {
  console.error("❌", e.message);
  process.exit(1);
} finally {
  await client.end();
}
