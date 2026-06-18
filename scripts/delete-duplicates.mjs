// Supprime les prospects EN DOUBLE : même entreprise présente plusieurs fois
// (typiquement plusieurs fiches Google pour le même business). On regroupe par
// (nom + ville) normalisés et, dans chaque groupe, on NE GARDE QU'UNE fiche —
// la plus « engagée » — et on supprime les autres.
//
// Pourquoi : un même pro qui a dit « non » sur une fiche ne dira pas « oui » sur
// une autre → un seul exemplaire suffit, et on préserve toujours le statut le
// plus avancé (un `negative` survit, donc plus jamais re-prospecté).
//
// Clé de regroupement : nom+ville par défaut. NAME_ONLY=1 → nom seul (plus
// agressif : fusionne aussi les homonymes de villes différentes).
//
// Dry-run par défaut : affiche les groupes et ce qui serait supprimé/gardé.
// Suppression réelle : node scripts/delete-duplicates.mjs --apply
//
// Lit les clés depuis .env.local (SUPABASE_SECRET_KEY = service role, requis
// pour passer la RLS sur DELETE). Les FK vers prospects sont CASCADE / SET NULL.
// Garde-fou : on ne supprime jamais une fiche portant un competitor_report.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const APPLY = process.argv.includes("--apply");
// Clé de regroupement : phone (défaut, le plus fiable — même n° = même business,
// même listé dans plusieurs villes), name-ville, ou name (le plus agressif).
const KEY = (process.env.KEY || "phone").toLowerCase();

/** Forme canonique FR du téléphone = 9 derniers chiffres. "" si inexploitable. */
function normPhone(phone) {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0033")) d = d.slice(4);
  else if (d.startsWith("33") && d.length >= 11) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(-9);
  return d.length === 9 ? d : "";
}

/** Normalise un libellé : minuscules, sans accents, espaces/ponctuation compactés. */
function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents (diacritiques combinants)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")     // ponctuation → espace
    .trim()
    .replace(/\s+/g, " ");
}

const STATUS_W = { positive: 6, negative: 5, called: 4, no_answer: 3, sms_sent: 2, todo: 1 };

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const PAGE = 1000;

async function fetchAll(table, select) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(select).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) { console.error(`Fetch ${table}:`, error.message); process.exit(1); }
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

// 1) Tous les prospects + signaux de tri.
const prospects = await fetchAll("prospects", "id, name, ville, phone, status, rating, reviews, notes, created_at");
console.log(`Prospects en base: ${prospects.length}`);

// 2) Qui a un rapport concurrent (à préserver) et qui a un historique d'appels.
const withReport = new Set((await fetchAll("competitor_reports", "prospect_id")).map((r) => r.prospect_id).filter(Boolean));
const withCalls = new Set((await fetchAll("calls", "prospect_id")).map((r) => r.prospect_id).filter(Boolean));
console.log(`Avec rapport concurrent: ${withReport.size} · avec historique d'appels: ${withCalls.size}`);

// 3) Regroupement.
function keyOf(p) {
  if (KEY === "phone") return normPhone(p.phone); // "" si tél inexploitable
  if (KEY === "name") return norm(p.name);
  return `${norm(p.name)}|${norm(p.ville)}`; // name-ville
}
const groups = new Map();
for (const p of prospects) {
  const key = keyOf(p);
  if (!key) continue; // clé vide (ex. tél/nom inexploitable) : jamais un doublon fiable
  let g = groups.get(key);
  if (!g) { g = []; groups.set(key, g); }
  g.push(p);
}

// Score de conservation (plus grand = on garde).
function rank(p) {
  return [
    withReport.has(p.id) ? 1 : 0,
    STATUS_W[p.status] ?? 0,
    withCalls.has(p.id) ? 1 : 0,
    (p.notes || "").trim().length > 0 ? 1 : 0,
    p.reviews ?? 0,
    p.rating ?? 0,
    -new Date(p.created_at || 0).getTime(), // plus ancienne d'abord (tie-break)
  ];
}
function better(a, b) {
  const ra = rank(a), rb = rank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] > rb[i] ? a : b;
  return a.id <= b.id ? a : b; // déterministe
}

const toDelete = [];
const sparedReports = []; // doublons portant un rapport : préservés malgré tout
let dupGroups = 0;
const samples = [];
for (const [key, g] of groups) {
  if (g.length < 2) continue;
  dupGroups++;
  const keep = g.reduce(better);
  const losers = g.filter((p) => p.id !== keep.id);
  const del = losers.filter((p) => !withReport.has(p.id));
  const spared = losers.filter((p) => withReport.has(p.id));
  toDelete.push(...del);
  sparedReports.push(...spared);
  if (samples.length < 12) samples.push({ key, keep, del, spared });
}

const byStatus = {};
for (const p of toDelete) byStatus[p.status] = (byStatus[p.status] || 0) + 1;

console.log(`\nClé de regroupement: ${KEY === "phone" ? "téléphone" : KEY === "name" ? "nom seul" : "nom + ville"}`);
console.log(`Groupes en double (≥2 fiches): ${dupGroups}`);
console.log(`Fiches à supprimer: ${toDelete.length}`);
console.log(`Doublons préservés (rapport concurrent): ${sparedReports.length}`);
console.log("À supprimer par statut:", byStatus);
console.log(`\nBase après suppression: ${prospects.length - toDelete.length}`);

console.log("\nExemples (✓ gardé · ✗ supprimé):");
for (const s of samples) {
  const k = s.keep;
  console.log(`  • ${k.name} — ${k.ville ?? "?"}`);
  console.log(`      ✓ ${k.phone} [${k.status}] avis:${k.reviews ?? 0}${withCalls.has(k.id) ? " +appels" : ""}${withReport.has(k.id) ? " +rapport" : ""}`);
  for (const d of s.del) console.log(`      ✗ ${d.phone} [${d.status}] avis:${d.reviews ?? 0}`);
  for (const d of s.spared) console.log(`      ⊘ ${d.phone} [${d.status}] (gardé : rapport concurrent)`);
}

if (toDelete.length === 0) { console.log("\nRien à supprimer."); process.exit(0); }

if (!APPLY) {
  console.log("\n[DRY-RUN] Aucune suppression. Relance avec --apply pour supprimer.");
  process.exit(0);
}

// Suppression par lots (un .in() de milliers d'UUID → 414 URI Too Large).
const ids = toDelete.map((p) => p.id);
const CHUNK = 200;
let deleted = 0;
for (let i = 0; i < ids.length; i += CHUNK) {
  const slice = ids.slice(i, i + CHUNK);
  const { error } = await sb.from("prospects").delete().in("id", slice);
  if (error) { console.error(`\nSuppression lot ${i}:`, error.message); process.exit(1); }
  deleted += slice.length;
  process.stdout.write(`\r  supprimés: ${deleted}/${ids.length}`);
}
console.log(`\n\n✓ Supprimé ${deleted} doublon(s). Base = ${prospects.length - deleted} prospects.`);
