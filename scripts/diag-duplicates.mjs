// DIAGNOSTIC (lecture seule) : compte les doublons restants selon plusieurs clés
// pour comprendre ce qui a échappé au dédoublonnage nom+ville.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

function normPhone(phone) {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0033")) d = d.slice(4);
  else if (d.startsWith("33") && d.length >= 11) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d.slice(-9);
}
function norm(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const PAGE = 1000;
const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb.from("prospects").select("id, name, ville, phone, status").order("id").range(from, from + PAGE - 1);
  if (error) { console.error(error.message); process.exit(1); }
  rows.push(...data);
  if (data.length < PAGE) break;
}
console.log(`Total prospects: ${rows.length}\n`);

// Surplus = lignes au-delà de 1 par groupe (= nb à supprimer pour cette clé).
function surplus(keyFn) {
  const g = new Map();
  for (const r of rows) { const k = keyFn(r); if (!k) continue; g.set(k, (g.get(k) || 0) + 1); }
  let groups = 0, extra = 0;
  for (const c of g.values()) if (c > 1) { groups++; extra += c - 1; }
  return { groups, extra };
}

const byPhone = surplus((r) => { const p = normPhone(r.phone); return p.length === 9 ? p : ""; });
const byName = surplus((r) => norm(r.name));
const byNameVille = surplus((r) => `${norm(r.name)}|${norm(r.ville)}`);
const byNamePhone = surplus((r) => { const p = normPhone(r.phone); return p.length === 9 ? `${norm(r.name)}|${p}` : ""; });

console.log("Doublons restants par clé (groupes / surplus à supprimer) :");
console.log(`  téléphone seul        : ${byPhone.groups} groupes / ${byPhone.extra} surplus`);
console.log(`  nom seul              : ${byName.groups} groupes / ${byName.extra} surplus`);
console.log(`  nom + ville           : ${byNameVille.groups} groupes / ${byNameVille.extra} surplus`);
console.log(`  nom + téléphone       : ${byNamePhone.groups} groupes / ${byNamePhone.extra} surplus`);

// Exemples : doublons par TÉLÉPHONE que nom+ville n'a PAS attrapés (nom ou ville diffère).
const phoneGroups = new Map();
for (const r of rows) { const p = normPhone(r.phone); if (p.length !== 9) continue; let a = phoneGroups.get(p); if (!a) { a = []; phoneGroups.set(p, a); } a.push(r); }
let shown = 0;
console.log("\nExemples de doublons par téléphone avec nom/ville DIFFÉRENTS (ratés par nom+ville) :");
for (const [p, g] of phoneGroups) {
  if (g.length < 2) continue;
  const keys = new Set(g.map((r) => `${norm(r.name)}|${norm(r.ville)}`));
  if (keys.size < 2) continue; // déjà attrapable par nom+ville
  console.log(`  • tél ${p} :`);
  for (const r of g) console.log(`      "${r.name}" — ${r.ville ?? "?"} [${r.status}]`);
  if (++shown >= 10) break;
}
if (shown === 0) console.log("  (aucun — les doublons restants ont nom ET ville identiques)");
