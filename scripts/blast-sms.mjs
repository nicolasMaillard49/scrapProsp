// Blast SMS de prospection (tunnel inversé).
// Sélectionne les prospects status=todo, filtre les MOBILES (06/07) uniques,
// puis envoie via l'endpoint PROD /api/sms (qui personnalise le message,
// utilise le Messaging Service Twilio + gère l'opt-out STOP).
//
//   node scripts/blast-sms.mjs                 -> dryRun, lot COMPLET (rien envoyé)
//   node scripts/blast-sms.mjs --limit 20      -> dryRun, 20 premiers
//   node scripts/blast-sms.mjs --limit 20 --send   -> ENVOI RÉEL des 20
//   node scripts/blast-sms.mjs --send          -> ENVOI RÉEL complet
//   options : --offset N (décale la sélection) · --force (ignore le garde-fou horaire)
//
// Garde-fou légal : envoi 8h–20h, hors dimanche (override avec --force).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const PROD = (process.env.NEXT_PUBLIC_DEMO_BASE_URL || "https://prospects.nmf-agence.com").replace(/\/$/, "");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const send = args.includes("--send");
const force = args.includes("--force");
const limit = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i + 1], 10) : null; })();
const offset = (() => { const i = args.indexOf("--offset"); return i >= 0 ? parseInt(args[i + 1], 10) : 0; })();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function norm(p) { if (!p) return ""; const d = ("" + p).replace(/\D/g, ""); if (d.startsWith("33")) return d; if (d.startsWith("0")) return "33" + d.slice(1); return d; }
const isMobile = (d) => /^33[67]\d{8}$/.test(d);

// ── garde-fou horaire (uniquement pour l'envoi réel) ──
if (send && !force) {
  const now = new Date();
  if (now.getDay() === 0 || now.getHours() < 8 || now.getHours() >= 20) {
    console.error(`⛔ Hors créneau légal (8h-20h, hors dimanche). Il est ${now.toLocaleString("fr-FR")}. Utilise --force pour passer outre.`);
    process.exit(1);
  }
}

// ── sélection : todo + mobiles uniques ──
let all = [], from = 0;
while (true) {
  const { data, error } = await sb.from("prospects").select("id,phone,status").eq("status", "todo").order("id", { ascending: true }).range(from, from + 999);
  if (error) { console.error("Supabase:", error.message); process.exit(1); }
  if (!data || !data.length) break;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}

const seen = new Set();
const cibles = [];
for (const p of all) {
  const d = norm(p.phone);
  if (!isMobile(d) || seen.has(d)) continue;
  seen.add(d);
  cibles.push(p.id);
}

let lot = cibles.slice(offset);
if (limit != null) lot = lot.slice(0, limit);

console.log(`Prospects todo : ${all.length} | mobiles uniques : ${cibles.length} | lot ciblé : ${lot.length}${limit != null ? ` (limit ${limit}, offset ${offset})` : ""}`);
if (!lot.length) { console.log("Rien à envoyer."); process.exit(0); }

// ── envoi via /api/sms prod, par lots de 50 ──
const BATCH = 50;
let sent = 0, failed = 0, segs = 0;
const samples = [];
for (let i = 0; i < lot.length; i += BATCH) {
  const ids = lot.slice(i, i + BATCH);
  const r = await fetch(PROD + "/api/sms", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "prospects-auth=ok" },
    body: JSON.stringify({ ids, dryRun: !send }),
  });
  const j = await r.json();
  if (!r.ok) { console.error("Erreur /api/sms:", r.status, JSON.stringify(j)); break; }
  sent += j.sent || 0; failed += j.failed || 0; segs += j.totalSegments || 0;
  for (const res of j.results || []) if (samples.length < 3) samples.push(res);
  console.log(`  lot ${Math.floor(i / BATCH) + 1} : ${j.sent} ok, ${j.failed} ko, ${j.totalSegments} seg${send ? "" : " (dryRun)"}`);
  await sleep(send ? 1200 : 200);
}

const usd = segs * 0.0798;
console.log(`\n${send ? "✓ ENVOYÉ" : "DRYRUN (rien envoyé)"} : ${sent} ok · ${failed} ko · ${segs} segments · ~$${usd.toFixed(2)} (~${(usd * 0.92).toFixed(0)} €)`);
console.log("Exemples :", JSON.stringify(samples.map((s) => ({ name: s.name, to: s.to, seg: s.segments, ok: s.ok, err: s.error })), null, 2));
