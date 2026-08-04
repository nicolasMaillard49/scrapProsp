// Amorce le bandit d'accroches : insère les variantes de départ pour M1 et S1.
//
// La PREMIÈRE variante de chaque étape reproduit l'accroche actuelle mot pour
// mot (via ses gabarits) : c'est le témoin. Sans témoin, on comparerait deux
// nouveautés entre elles sans jamais savoir si l'une bat ce qu'on faisait déjà.
//
// Gabarits disponibles (cf. accrocheVars) : {hello} {prenom} {metier} {lieu}
// {ville}. Un gabarit sans valeur ANNULE la variante pour ce prospect-là, qui
// reçoit alors l'accroche standard — d'où le témoin, qui n'utilise que {hello}
// et {metier}, les deux plus souvent renseignés.
//
// Idempotent : une variante de même (step, label) n'est pas réinsérée.
// Pour tout arrêter : update ig_trame_variants set active = false;
//
// Usage : node scripts/seed-trame-variants.mjs

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

// Toutes tiennent en une ligne, finissent par une question fermée, ne vendent
// rien et ne citent aucun lien : les règles de la trame ne se suspendent pas
// parce qu'on teste.
const VARIANTS = [
  // ── Trame standard ──
  {
    step: "M1",
    label: "témoin",
    text: "{hello} ! J'ai vu que vous étiez {metier}, c'est toujours le cas ?",
  },
  {
    step: "M1",
    label: "voisinage",
    // Deux pièges que le gabarit ne sait pas gérer, évités par la formulation :
    //  - « des {metier} » demanderait un pluriel (« des menuisier ») ;
    //  - « du côté de {ville} » demanderait l'élision (« de Agen »).
    // « à {ville} » marche pour toutes les villes, sans table d'exceptions.
    text: "{hello} ! Je suis tombé sur votre compte en cherchant un {metier} à {ville} — vous prenez encore de nouveaux clients ?",
  },
  {
    step: "M1",
    label: "question directe",
    text: "{hello} ! Question rapide : vous êtes bien {metier} à {ville} ?",
  },
  // ── Trame site ── (même accroche que la standard : c'est voulu, seule la
  // suite change. On la met quand même en concurrence : rien ne dit que la
  // meilleure ouverture est la même quand le 2e message parle de Google.)
  {
    step: "S1",
    label: "témoin",
    text: "{hello} ! J'ai vu que vous étiez {metier}, c'est toujours le cas ?",
  },
  {
    step: "S1",
    label: "visibilité",
    text: "{hello} ! Je cherchais un {metier} à {ville} et je suis tombé sur votre compte — vous êtes toujours en activité ?",
  },
];

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();

  let ajout = 0;
  for (const v of VARIANTS) {
    const { rowCount } = await client.query(
      "insert into ig_trame_variants (step, label, text)" +
        " select $1, $2, $3" +
        " where not exists (select 1 from ig_trame_variants where step = $1 and label = $2)",
      [v.step, v.label, v.text],
    );
    if (rowCount) ajout++;
  }

  const { rows } = await client.query(
    "select step, label, sent, replied, active from ig_trame_variants order by step, label",
  );
  console.log(`✓ ${ajout} variante(s) ajoutée(s) — ${rows.length} au total\n`);
  for (const r of rows) {
    const taux = r.sent > 0 ? `${Math.round((100 * r.replied) / r.sent)} %` : "—";
    console.log(`   ${r.step}  ${r.label.padEnd(18)} ${String(r.sent).padStart(4)} envois · ${taux}${r.active ? "" : "  (inactive)"}`);
  }
  console.log("\n   Pour tout arrêter : update ig_trame_variants set active = false;");
} catch (err) {
  console.error("❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
