// Applique supabase/migration-027-ig-dm-log-unicite.sql
// (unicité d'un envoi : prospect + étape + jour civil Paris).
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans .env.local.
//
// Usage : node scripts/apply-migration-027.mjs [--dry]
//   --dry : montre ce qui serait supprimé, sans rien écrire.

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
    const val = t.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ SUPABASE_DB_URL manquant dans .env.local");
  process.exit(1);
}

const dry = process.argv.includes("--dry");
const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

// L'inventaire des doublons, calculé sans rien modifier : la migration supprime
// des lignes, on regarde toujours ce qu'on supprime avant de le supprimer.
const INVENTAIRE = `
  WITH j AS (
    SELECT prospect_id, step, (sent_at AT TIME ZONE 'Europe/Paris')::date AS jour, count(*) AS n
      FROM ig_dm_log
     WHERE prospect_id IS NOT NULL
     GROUP BY 1, 2, 3
    HAVING count(*) > 1
  )
  -- ::text volontaire : node-pg rend une colonne 'date' sous forme de Date JS à
  -- minuit LOCAL, et toute relecture en UTC recule alors l'affichage d'un jour.
  -- Un rapport qui annonce la mauvaise date avant une suppression est pire
  -- qu'inutile.
  SELECT jour::text AS jour, step, count(*)::int AS groupes, (sum(n) - count(*))::int AS a_supprimer
    FROM j GROUP BY jour, step ORDER BY jour DESC, step
`;

try {
  await client.connect();
  console.log("✓ Connecté à Postgres");

  const { rows: avant } = await client.query("SELECT count(*)::int AS n FROM ig_dm_log");
  const { rows: dups } = await client.query(INVENTAIRE);
  const total = dups.reduce((a, r) => a + r.a_supprimer, 0);

  console.log(`\n${avant[0].n} lignes dans ig_dm_log · ${total} doublon(s) à supprimer\n`);
  for (const r of dups) {
    console.log(`  ${r.jour}  ${r.step.padEnd(3)} ${String(r.a_supprimer).padStart(3)} doublon(s) sur ${r.groupes} prospect(s)`);
  }

  if (dry) {
    console.log("\n(--dry : rien n'a été écrit)");
    process.exit(0);
  }

  const sql = readFileSync(resolve(ROOT, "supabase", "migration-027-ig-dm-log-unicite.sql"), "utf-8");
  await client.query(sql);

  const { rows: apres } = await client.query(
    `SELECT (SELECT count(*) FROM ig_dm_log)::int AS lignes,
            (SELECT count(*) FROM ig_dm_log WHERE step IN ('M1','S1')
              AND sent_day = (now() AT TIME ZONE 'Europe/Paris')::date)::int AS accroches_jour`,
  );
  console.log(
    `\n✓ Migration 027 appliquée — ${apres[0].lignes} lignes restantes (${avant[0].n - apres[0].lignes} supprimées).`,
  );
  console.log(`  Accroches d'aujourd'hui, après dédoublonnage : ${apres[0].accroches_jour}`);
} catch (err) {
  console.error("❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
