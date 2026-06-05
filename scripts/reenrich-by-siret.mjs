// Passe ciblée : ré-enrichit les prospects DÉJÀ matchés (SIRET présent)
// mais dont le nom de dirigeant (ou les champs élargis) sont vides.
// Le matching initial par "nom + ville" échoue sur les noms bruités ;
// ici on interroge l'API directement PAR SIRET → match déterministe.
// Source : https://recherche-entreprises.api.gouv.fr — gratuit, sans auth.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(ROOT, "public");
const API = "https://recherche-entreprises.api.gouv.fr/search";
const REQ_DELAY_MS = 180;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function yearsSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

// INSEE — tranche d'effectif salarié (code → libellé lisible)
const EFFECTIF_LABELS = {
  NN: "Non renseigné",
  "00": "0 salarié",
  "01": "1-2 salariés",
  "02": "3-5 salariés",
  "03": "6-9 salariés",
  "11": "10-19 salariés",
  "12": "20-49 salariés",
  "21": "50-99 salariés",
  "22": "100-199 salariés",
  "31": "200-249 salariés",
  "32": "250-499 salariés",
  "41": "500-999 salariés",
  "42": "1000-1999 salariés",
  "51": "2000-4999 salariés",
  "52": "5000-9999 salariés",
  "53": "10000+ salariés",
};

// L'API renvoie parfois le nom dupliqué entre parenthèses : "DUPONT (DUPONT)".
function cleanDirigeantNom(nom) {
  if (!nom) return "";
  return String(nom).replace(/\s*\(.*\)\s*$/, "").trim();
}

// Sélectionne le dirigeant le plus pertinent (personne physique en priorité).
function pickDirigeant(dirigeants) {
  if (!Array.isArray(dirigeants) || dirigeants.length === 0) return null;
  return (
    dirigeants.find((d) => d.type_dirigeant === "personne physique") ||
    dirigeants[0]
  );
}

async function lookupSiret(siret) {
  const url = `${API}?q=${encodeURIComponent(siret)}&per_page=1`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.status === 429) {
        await sleep(1500);
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const results = j?.results || [];
      // Privilégie le résultat dont le siège correspond au SIRET interrogé.
      return (
        results.find((x) => x.siege?.siret === siret) || results[0] || null
      );
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(600);
    }
  }
  return null;
}

// Une ligne est "à compléter" si elle a un SIRET mais qu'il lui manque
// au moins un des champs élargis qu'un lookup SIRET peut remplir.
function needsReenrich(p) {
  if (!(p.siret && p.siret.trim())) return false;
  return !(p.dirigeant_nom && p.dirigeant_nom.trim());
}

async function reenrichRegion(regionEntry) {
  const csvPath = resolve(PUBLIC_DIR, regionEntry.csv.replace(/^\//, ""));
  if (!existsSync(csvPath)) {
    console.log(`  ⚠ skip — fichier introuvable : ${csvPath}`);
    return { total: 0, candidates: 0, recovered: 0, noDir: 0 };
  }
  const raw = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  const rows = parsed.data;

  const todo = rows.filter(needsReenrich);
  console.log(`\n=== ${regionEntry.label} — ${todo.length} à compléter / ${rows.length} ===`);
  if (todo.length === 0) return { total: rows.length, candidates: 0, recovered: 0, noDir: 0 };

  let recovered = 0;
  let noDir = 0;
  let lastLogLen = 0;

  for (let i = 0; i < todo.length; i++) {
    const p = todo[i];
    const status = `  [${i + 1}/${todo.length}] ${p.name?.slice(0, 40) || ""}`;
    process.stdout.write("\r" + " ".repeat(lastLogLen) + "\r" + status);
    lastLogLen = status.length;

    const best = await lookupSiret(p.siret.trim());

    if (best) {
      const siege = best.siege || {};
      const dateC = best.date_creation || siege.date_creation || "";
      const age = yearsSince(dateC);

      // Ne réécrase pas une valeur déjà présente, complète les trous.
      if (!p.created_at) p.created_at = dateC;
      if (!p.age_years && age != null) p.age_years = String(age);
      if (!p.legal_status || p.legal_status === "inconnu")
        p.legal_status = best.etat_administratif === "A" ? "actif" : "radie";
      if (!p.naf_code) p.naf_code = best.activite_principale || "";

      const dir = pickDirigeant(best.dirigeants);
      if (dir) {
        p.dirigeant_nom = cleanDirigeantNom(dir.nom);
        p.dirigeant_prenom = dir.prenoms || "";
        p.dirigeant_annee_naissance = dir.annee_de_naissance || "";
        recovered++;
      } else {
        noDir++;
      }

      const effCode = best.tranche_effectif_salarie || siege.tranche_effectif_salarie || "";
      if (!p.tranche_effectif) p.tranche_effectif = effCode;
      if (!p.effectif_label) p.effectif_label = EFFECTIF_LABELS[effCode] || "";
      if (!p.latitude) p.latitude = siege.latitude || "";
      if (!p.longitude) p.longitude = siege.longitude || "";
      if (!p.est_rge) p.est_rge = best.complements?.est_rge ? "true" : "false";
      if (!p.nature_juridique) p.nature_juridique = best.nature_juridique || "";
      if (!p.categorie) p.categorie = best.categorie_entreprise || "";
    } else {
      noDir++;
    }

    await sleep(REQ_DELAY_MS);
  }

  process.stdout.write("\r" + " ".repeat(lastLogLen) + "\r");
  console.log(`  → ${recovered} noms récupérés · ${noDir} sans dirigeant personne physique`);

  const columns = [
    "name", "metier", "phone", "ville", "departement", "region", "region_label",
    "rating", "reviews", "hours_status", "is_open_now", "address", "maps_url",
    "siret", "created_at", "age_years", "legal_status", "naf_code",
    "dirigeant_nom", "dirigeant_prenom", "dirigeant_annee_naissance",
    "tranche_effectif", "effectif_label", "latitude", "longitude",
    "est_rge", "nature_juridique", "categorie",
  ];
  const newCsv = Papa.unparse(rows, { columns });
  writeFileSync(csvPath, "﻿" + newCsv + "\n", "utf8");

  return { total: rows.length, candidates: todo.length, recovered, noDir };
}

async function main() {
  const manifestPath = resolve(PUBLIC_DIR, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  console.log(`Ré-enrichissement par SIRET — ${manifest.regions.length} régions`);

  const stats = [];
  for (const r of manifest.regions) {
    const s = await reenrichRegion(r);
    stats.push({ region: r.label, ...s });
  }

  console.log("\n=== RÉSUMÉ ===");
  const totals = stats.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      candidates: acc.candidates + s.candidates,
      recovered: acc.recovered + s.recovered,
      noDir: acc.noDir + s.noDir,
    }),
    { total: 0, candidates: 0, recovered: 0, noDir: 0 },
  );
  console.table([...stats, { region: "— TOTAL —", ...totals }]);

  manifest.reenriched_at = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✓ manifest.json mis à jour (reenriched_at)`);
}

main().catch((err) => {
  console.error("\n❌ Échec :", err);
  process.exit(1);
});
