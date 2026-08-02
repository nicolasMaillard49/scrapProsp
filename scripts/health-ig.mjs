// Interroge le canari de la chaîne de prospection Instagram et rend un verdict
// lisible en une seconde — « est-ce que ça va marcher demain matin ? ».
//
// Le canari paie un VRAI appel au modèle sur un lot synthétique : c'est le seul
// test qui attrape un modèle inconnu (le 404 du 02/08 qui a vidé la sélection
// une journée entière). Rien n'est écrit en base.
//
// Usage : npm run health:ig            (prod, via APP_URL)
//         npm run health:ig -- --local (contre http://localhost:3000)
//
// Requiert CRON_SECRET dans .env.local. Sort en code 1 si la chaîne est cassée,
// pour être enchaînable dans un script.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

const SECRET = process.env.CRON_SECRET;
if (!SECRET) {
  console.error("CRON_SECRET manquant dans .env.local — impossible d'interroger le canari.");
  process.exit(2);
}

const local = process.argv.includes("--local");
const base = local
  ? "http://localhost:3000"
  : (process.env.APP_URL || "https://prospects.nmf-agence.com").replace(/\/$/, "");

console.log(`canari → ${base}/api/health/ig`);

let report;
try {
  const res = await fetch(`${base}/api/health/ig`, {
    method: "POST",
    headers: { "x-cron-secret": SECRET },
  });
  const text = await res.text();
  try {
    report = JSON.parse(text);
  } catch {
    console.error(`réponse illisible (HTTP ${res.status}) : ${text.slice(0, 300)}`);
    process.exit(2);
  }
  if (res.status === 401) {
    console.error("401 — le CRON_SECRET local ne correspond pas à celui de Vercel.");
    process.exit(2);
  }
} catch (e) {
  console.error(`canari injoignable : ${e.message}`);
  process.exit(2);
}

const icone = (c) => (!c.ok ? "✗" : c.alerte ? "!" : "✓");
for (const c of report.checks || []) {
  console.log(`  ${icone(c)} ${c.poste.padEnd(6)} ${c.detail}`);
}
console.log(`\n${report.ok ? "✓" : "✗"} ${report.resume}`);
process.exit(report.ok ? 0 : 1);
