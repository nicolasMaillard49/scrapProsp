// Enrich prospects-tracker CSVs with SIRENE data
// (siret, date_creation, age, statut, NAF, dirigeant, effectif,
//  lat/lon, RGE, nature juridique, catégorie entreprise)
// Source : https://recherche-entreprises.api.gouv.fr — gratuit, sans auth.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(ROOT, "public");
const API = "https://recherche-entreprises.api.gouv.fr/search";
const REQ_DELAY_MS = 160;
const MATCH_THRESHOLD = 0.4;

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (s) =>
  new Set(
    norm(s)
      .split(" ")
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );

const STOP = new Set([
  "sas", "sasu", "sarl", "eurl", "snc", "sci", "ets", "etb",
  "ent", "entr", "entreprise", "societe", "ste",
  "monsieur", "mme", "mr", "madame",
]);

function jaccard(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

async function searchSirene(query) {
  const q = encodeURIComponent(query);
  const url = `${API}?q=${q}&per_page=10&page=1`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.status === 429) {
        await sleep(1500);
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(600);
    }
  }
  return null;
}

function pickBest(results, name, ville) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const villeNorm = norm(ville);
  let best = null;
  let bestScore = 0;

  for (const r of results) {
    const candidates = [
      r.nom_complet,
      r.nom_raison_sociale,
      r.sigle,
      r.matching_etablissements?.[0]?.enseigne_1,
      r.matching_etablissements?.[0]?.nom_commercial,
    ].filter(Boolean);
    let nameScore = 0;
    for (const c of candidates) {
      const s = jaccard(c, name);
      if (s > nameScore) nameScore = s;
    }
    if (nameScore < 0.2) continue;

    const sieges = [r.siege, ...(r.matching_etablissements || [])].filter(Boolean);
    const villeMatch = sieges.some((s) => norm(s.commune || s.libelle_commune || "") === villeNorm);
    const isActive = r.etat_administratif === "A";
    const isArtisan = (r.activite_principale || "").startsWith("43"); // construction spécialisée

    let score = nameScore;
    if (villeMatch) score += 0.4;
    if (isActive) score += 0.1;
    if (isArtisan) score += 0.1;

    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  return bestScore >= MATCH_THRESHOLD ? best : null;
}

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

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function enrichRegion(regionEntry) {
  const csvPath = resolve(PUBLIC_DIR, regionEntry.csv.replace(/^\//, ""));
  if (!existsSync(csvPath)) {
    console.log(`  ⚠ skip — fichier introuvable : ${csvPath}`);
    return { total: 0, matched: 0, radie: 0, jeune: 0 };
  }
  const raw = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  const rows = parsed.data;

  console.log(`\n=== ${regionEntry.label} (${rows.length}) ===`);

  let matched = 0;
  let radie = 0;
  let jeune = 0;
  let lastLogLen = 0;

  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];
    const status = `  [${i + 1}/${rows.length}] ${p.name?.slice(0, 40) || ""}`;
    process.stdout.write("\r" + " ".repeat(lastLogLen) + "\r" + status);
    lastLogLen = status.length;

    const query = `${p.name} ${p.ville}`.trim();
    const json = await searchSirene(query);
    const best = pickBest(json?.results || [], p.name, p.ville);

    if (best) {
      const siege = best.siege || {};
      const dateC = best.date_creation || siege.date_creation || "";
      const age = yearsSince(dateC);
      p.siret = siege.siret || best.matching_etablissements?.[0]?.siret || "";
      p.created_at = dateC;
      p.age_years = age != null ? String(age) : "";
      p.legal_status = best.etat_administratif === "A" ? "actif" : "radie";
      p.naf_code = best.activite_principale || "";

      // — Champs élargis —
      const dir = pickDirigeant(best.dirigeants);
      p.dirigeant_nom = dir ? cleanDirigeantNom(dir.nom) : "";
      p.dirigeant_prenom = dir?.prenoms || "";
      p.dirigeant_annee_naissance = dir?.annee_de_naissance || "";

      const effCode = best.tranche_effectif_salarie || siege.tranche_effectif_salarie || "";
      p.tranche_effectif = effCode;
      p.effectif_label = EFFECTIF_LABELS[effCode] || "";

      p.latitude = siege.latitude || "";
      p.longitude = siege.longitude || "";

      p.est_rge = best.complements?.est_rge ? "true" : "false";
      p.nature_juridique = best.nature_juridique || "";
      p.categorie = best.categorie_entreprise || "";

      matched++;
      if (p.legal_status === "radie") radie++;
      if (age != null && age < 5) jeune++;
    } else {
      p.siret = p.siret || "";
      p.created_at = p.created_at || "";
      p.age_years = p.age_years || "";
      p.legal_status = p.legal_status || "inconnu";
      p.naf_code = p.naf_code || "";

      p.dirigeant_nom = p.dirigeant_nom || "";
      p.dirigeant_prenom = p.dirigeant_prenom || "";
      p.dirigeant_annee_naissance = p.dirigeant_annee_naissance || "";
      p.tranche_effectif = p.tranche_effectif || "";
      p.effectif_label = p.effectif_label || "";
      p.latitude = p.latitude || "";
      p.longitude = p.longitude || "";
      p.est_rge = p.est_rge || "";
      p.nature_juridique = p.nature_juridique || "";
      p.categorie = p.categorie || "";
    }

    await sleep(REQ_DELAY_MS);
  }

  process.stdout.write("\r" + " ".repeat(lastLogLen) + "\r");
  console.log(`  → ${matched}/${rows.length} matchés (${radie} radiées · ${jeune} < 5 ans)`);

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

  return { total: rows.length, matched, radie, jeune };
}

async function main() {
  const manifestPath = resolve(PUBLIC_DIR, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  console.log(`Enrichissement SIRENE — ${manifest.regions.length} régions`);

  const stats = [];
  for (const r of manifest.regions) {
    const s = await enrichRegion(r);
    stats.push({ region: r.label, ...s });
  }

  console.log("\n=== RÉSUMÉ ===");
  const totals = stats.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      matched: acc.matched + s.matched,
      radie: acc.radie + s.radie,
      jeune: acc.jeune + s.jeune,
    }),
    { total: 0, matched: 0, radie: 0, jeune: 0 },
  );
  console.table([...stats, { region: "— TOTAL —", ...totals }]);

  manifest.enriched_at = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✓ manifest.json mis à jour (enriched_at)`);
}

main().catch((err) => {
  console.error("\n❌ Échec :", err);
  process.exit(1);
});
