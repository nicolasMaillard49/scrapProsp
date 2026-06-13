// Écarte les "grosses boîtes" du pool de prospection en passant source -> "trop_gros"
// (réversible, uniquement status=todo). Trois familles de cibles :
//   1. SIRENE ETI/GE ou effectif >= 50 salariés (haute précision, tous métiers)
//   2. Bruit non-artisan : transporteurs de colis + garde-meuble / self-stockage
//   3. Déménageurs déjà établis : metier=demenageur ET reviews >= SEUIL (défaut 50)
//
// Usage :
//   node scripts/flag-big-companies.mjs                 # dry-run (n'écrit rien)
//   node scripts/flag-big-companies.mjs --apply         # applique + écrit le backup
//   node scripts/flag-big-companies.mjs --apply --demenageur-min 80
//   node scripts/flag-big-companies.mjs --undo          # restaure depuis le backup
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BACKUP = resolve(ROOT, "scripts", "trop-gros-backup.json");

const APPLY = process.argv.includes("--apply");
const UNDO = process.argv.includes("--undo");
const demArgIdx = process.argv.indexOf("--demenageur-min");
const DEM_MIN = demArgIdx !== -1 ? parseInt(process.argv[demArgIdx + 1], 10) : 50;

for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf-8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const key = t.slice(0, eq).trim();
  if (!(key in process.env)) process.env[key] = t.slice(eq + 1).trim();
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

// ── Mode UNDO ───────────────────────────────────────────────────────────────
if (UNDO) {
  if (!existsSync(BACKUP)) {
    console.error(`Aucun backup trouvé (${BACKUP}). Rien à restaurer.`);
    process.exit(1);
  }
  const map = JSON.parse(readFileSync(BACKUP, "utf-8")); // { id: prevSource }
  const ids = Object.keys(map);
  console.log(`Restauration de ${ids.length} fiches depuis le backup…`);
  let ok = 0;
  for (const id of ids) {
    const res = await fetch(`${SB_URL}/rest/v1/prospects?id=eq.${id}&source=eq.trop_gros`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ source: map[id] }),
    });
    if (res.ok) ok++;
    else console.log(`ERREUR restore ${id}: ${res.status}`);
  }
  console.log(`✔ ${ok}/${ids.length} restaurées (source d'origine).`);
  process.exit(0);
}

// ── Critères ──────────────────────────────────────────────────────────────
const EFFECTIF_BIG = new Set(["21", "22", "31", "32", "41", "42", "51", "52", "53"]); // >= 50 salariés
// Transporteurs de colis / messagerie — jamais des cibles "site artisan".
const CARRIER = /\b(dpd|gls|chronopost|colissimo|geodis|dachser|xpo|kuehne|dhl|fedex|ups|tnt|heppner|mondial relay)\b|la poste/i;
// Garde-meuble / self-stockage — ni des déménageurs locaux, ni des artisans.
const STORAGE = /(garde[- ]?meuble|self[- ]?stock|selfstock|self stockage|box de stockage|location de box|primaubox|shurgard|homebox|annexx|costockage|resotainer|une pi[eèé]ce en plus)/i;

function classify(p) {
  const cat = (p.categorie || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  if (cat === "ETI" || cat === "GE") return `SIRENE ${cat}`;
  if (p.tranche_effectif && EFFECTIF_BIG.has(p.tranche_effectif)) return `effectif ${p.effectif_label || p.tranche_effectif}`;
  const name = p.name || "";
  if (CARRIER.test(name)) return "transporteur colis";
  if (STORAGE.test(name)) return "garde-meuble / stockage";
  if (p.metier === "demenageur" && (p.reviews ?? 0) >= DEM_MIN) return `déménageur ≥${DEM_MIN} avis`;
  return null;
}

// ── Chargement (pagination) ───────────────────────────────────────────────
const rows = [];
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(
    `${SB_URL}/rest/v1/prospects?select=id,name,metier,ville,reviews,categorie,tranche_effectif,effectif_label,status,source&status=eq.todo&limit=1000&offset=${offset}`,
    { headers },
  );
  if (!res.ok) throw new Error(`Supabase: ${res.status} ${await res.text()}`);
  const page = await res.json();
  rows.push(...page);
  if (page.length < 1000) break;
}
console.log(`${rows.length} prospects en status=todo chargés. Seuil déménageur : ≥${DEM_MIN} avis.\n`);

const hits = [];
const byReason = {};
for (const p of rows) {
  if (p.source === "trop_gros") continue; // déjà écarté
  const reason = classify(p);
  if (!reason) continue;
  hits.push({ ...p, reason });
  byReason[reason] = (byReason[reason] || 0) + 1;
}

console.log("=== À écarter (source -> trop_gros) ===");
for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${r}`);
}
console.log(`  ${String(hits.length).padStart(4)}  TOTAL\n`);

// Échantillon par raison
const shown = {};
console.log("— Échantillon (5 par raison) —");
for (const h of hits) {
  shown[h.reason] = (shown[h.reason] || 0) + 1;
  if (shown[h.reason] <= 5) console.log(`  [${h.reason}] ${h.name} (${h.ville}) ${h.reviews ?? "?"} avis`);
}

if (!APPLY) {
  console.log(`\n(dry-run — relance avec --apply pour écarter les ${hits.length} fiches)`);
  process.exit(0);
}

// ── APPLY ──────────────────────────────────────────────────────────────────
const backup = {};
let updated = 0;
for (const h of hits) {
  const res = await fetch(`${SB_URL}/rest/v1/prospects?id=eq.${h.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ source: "trop_gros" }),
  });
  if (res.ok) {
    backup[h.id] = h.source ?? null; // pour le --undo
    updated++;
    if (updated % 100 === 0) console.log(`  …${updated}/${hits.length}`);
  } else {
    console.log(`ERREUR update ${h.name}: ${res.status} ${await res.text().catch(() => "")}`);
  }
}
// Fusionne avec un backup existant (si on relance le script plusieurs fois)
const prev = existsSync(BACKUP) ? JSON.parse(readFileSync(BACKUP, "utf-8")) : {};
writeFileSync(BACKUP, JSON.stringify({ ...prev, ...backup }, null, 2));
console.log(`\n✔ ${updated}/${hits.length} passés en source=trop_gros.`);
console.log(`📦 Backup écrit dans ${BACKUP} (relance avec --undo pour tout restaurer).`);
