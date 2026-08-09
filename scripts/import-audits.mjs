// Verse les audits du dépôt `audit-nmf` dans les dossiers clients du CRM.
//
// Le dépôt d'archive (`D:\projets\audit`, ~1 Go, PDF générés en local) n'est PAS
// déployé : ses fichiers n'existent que sur cette machine. Tant qu'ils y restent,
// un audit livré est introuvable depuis la fiche client — il est refait, ou une
// version périmée repart chez le client.
//
// Ce script fait le pont : il pousse les PDF dans le bucket `crm` et les
// rattache au bon dossier. Une fois versés, ils sont lisibles depuis n'importe
// où, y compris en production, derrière l'authentification de l'app.
//
// Ne verse QUE les versions CLIENT par défaut : les rapports internes nomment
// nos propres défauts de livraison, ils n'ont rien à faire à un clic d'un écran
// qu'on ouvre devant le client. `--tout` lève cette réserve.
//
// Usage :
//   node scripts/import-audits.mjs                  # aperçu, rien n'est écrit
//   node scripts/import-audits.mjs --ecrire         # verse pour de bon
//   node scripts/import-audits.mjs --ecrire --tout  # versions internes comprises

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEPOT = process.env.AUDIT_REPO ?? "D:/projets/audit";

const ECRIRE = process.argv.includes("--ecrire");
const TOUT = process.argv.includes("--tout");

for (const line of existsSync(resolve(ROOT, ".env.local"))
  ? readFileSync(resolve(ROOT, ".env.local"), "utf-8").split(/\r?\n/)
  : []) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq > 0 && !(t.slice(0, eq).trim() in process.env)) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY requis dans .env.local");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });

/** Un rapport INTERNE ne part jamais chez le client — il nomme nos propres défauts. */
const INTERNE = /audit-digital-google-ads|interne|legacy/i;

/** Les LIVRABLES : ce qu'on a effectivement remis, par opposition aux essais. */
const LIVRABLE = /client|proposition|recap|résum|resum|potentiel/i;

/** Brouillons et variantes de travail — la chaîne en produit beaucoup. */
const BROUILLON = /draft|brouillon|-v\d|budget-\d|test\b/i;

/**
 * Ce qu'on verse d'un dossier d'audit.
 *
 * Un dossier de production contient quinze PDF : les variantes de budget, les
 * essais de zone, les versions successives. Les verser tous ferait du dossier
 * client une décharge, et la question « quel PDF a-t-il reçu ? » resterait sans
 * réponse — c'est-à-dire exactement le problème qu'on veut résoudre.
 *
 * On garde donc ce qui est nommé comme un livrable ; à défaut, le plus récent.
 */
function selection(fichiers) {
  const propres = fichiers.filter((f) => !BROUILLON.test(f.nom));
  const livrables = propres.filter((f) => LIVRABLE.test(f.nom));
  if (livrables.length) return livrables;
  const recent = [...propres].sort((a, b) => b.mtime - a.mtime)[0];
  return recent ? [recent] : [];
}

/** Tous les PDF d'un dossier d'audit, récursivement. */
function pdfs(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === "node_modules" || e === "tmp" || e.startsWith(".")) continue;
    const st = statSync(p);
    if (st.isDirectory()) pdfs(p, acc);
    else if (e.toLowerCase().endsWith(".pdf")) acc.push({ path: p, nom: e, taille: st.size, mtime: st.mtimeMs });
  }
  return acc;
}

/** Rapproche un dossier d'audit d'un dossier client, par nom normalisé. */
const norme = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const { data: clients, error } = await db.from("clients").select("id, nom, instagram_prospect_id");
if (error) {
  console.error("❌", error.message);
  process.exit(1);
}

const dossiers = readdirSync(DEPOT).filter((d) => {
  if (d.startsWith(".") || d === "node_modules" || d === "_local") return false;
  return statSync(join(DEPOT, d)).isDirectory();
});

let verses = 0;
let ignores = 0;

for (const d of dossiers) {
  const cible = clients.find((c) => norme(c.nom).includes(norme(d)) || norme(d).includes(norme(c.nom)));
  const tous = pdfs(join(DEPOT, d)).filter((f) => TOUT || !INTERNE.test(f.nom));
  const fichiers = TOUT ? tous : selection(tous);
  // Jamais de coupe silencieuse : ce qui est écarté est annoncé.
  const ecartes = tous.length - fichiers.length;

  if (!cible) {
    console.log(`· ${d} — aucun dossier client ne correspond (${fichiers.length} PDF laissés sur place)`);
    ignores += fichiers.length;
    continue;
  }
  if (!fichiers.length) {
    console.log(`· ${d} → ${cible.nom} — aucun PDF client`);
    continue;
  }
  if (ecartes > 0) console.log(`· ${d} — ${ecartes} brouillon(s)/variante(s) écarté(s), --tout pour les inclure`);

  const { data: deja } = await db.from("client_documents").select("nom").eq("client_id", cible.id);
  const presents = new Set((deja ?? []).map((x) => x.nom));

  for (const f of fichiers) {
    if (presents.has(f.nom)) {
      console.log(`  = ${f.nom} — déjà au dossier`);
      continue;
    }
    if (!ECRIRE) {
      console.log(`  + ${d} → ${cible.nom} : ${f.nom} (${(f.taille / 1e6).toFixed(1)} Mo)`);
      verses++;
      continue;
    }
    const chemin = `${cible.id}/${crypto.randomUUID()}.pdf`;
    const { error: up } = await db.storage
      .from("crm")
      .upload(chemin, readFileSync(f.path), { contentType: "application/pdf", upsert: false });
    if (up) {
      console.log(`  ❌ ${f.nom} : ${up.message}`);
      continue;
    }
    const { error: ins } = await db.from("client_documents").insert({
      client_id: cible.id,
      path: chemin,
      nom: f.nom,
      mime: "application/pdf",
      taille: f.taille,
      kind: "audit",
    });
    if (ins) {
      await db.storage.from("crm").remove([chemin]);
      console.log(`  ❌ ${f.nom} : ${ins.message}`);
      continue;
    }
    console.log(`  ✓ ${d} → ${cible.nom} : ${f.nom} (${(f.taille / 1e6).toFixed(1)} Mo)`);
    verses++;
  }
}

console.log(
  ECRIRE
    ? `\n${verses} audit(s) versé(s)${ignores ? `, ${ignores} sans dossier client` : ""}`
    : `\n${verses} audit(s) à verser${ignores ? `, ${ignores} sans dossier client` : ""} — relancer avec --ecrire`,
);
