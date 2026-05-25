// Migrate CSV data + existing localStorage state (state-seed.json) into Supabase.
// Usage: node scripts/migrate-to-supabase.mjs
//
// Requires env vars:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";

// ── paths ───────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(ROOT, "public");

// ── env ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing env vars NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── helpers ─────────────────────────────────────────────────────────────
const BATCH_SIZE = 100;

function parseRating(raw) {
  if (!raw) return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function parseReviews(raw) {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function parseDate(raw) {
  if (!raw || raw === "") return null;
  return raw; // already in YYYY-MM-DD format from the CSV
}

function parseAge(raw) {
  if (!raw || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

// ── load manifest ───────────────────────────────────────────────────────
const manifestPath = resolve(PUBLIC_DIR, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error("manifest.json not found at", manifestPath);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
console.log(
  `Loaded manifest: ${manifest.regions.length} region(s) — generated ${manifest.generated_at}`,
);

// ── load state-seed ─────────────────────────────────────────────────────
const stateSeedPath = resolve(PUBLIC_DIR, "state-seed.json");
let stateSeed = {};
if (existsSync(stateSeedPath)) {
  stateSeed = JSON.parse(readFileSync(stateSeedPath, "utf-8"));
  const entryCount = Object.keys(stateSeed).length;
  console.log(`Loaded state-seed.json: ${entryCount} entries`);
} else {
  console.log("No state-seed.json found, using defaults for all prospects");
}

// ── parse all CSVs ──────────────────────────────────────────────────────
const allRows = [];

for (const region of manifest.regions) {
  const csvPath = resolve(PUBLIC_DIR, region.csv.replace(/^\//, ""));
  if (!existsSync(csvPath)) {
    console.warn(`  CSV not found: ${csvPath}, skipping`);
    continue;
  }
  const csvText = readFileSync(csvPath, "utf-8");
  const { data, errors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  if (errors.length) {
    console.warn(
      `  PapaParse warnings for ${region.key}:`,
      errors.slice(0, 3),
    );
  }
  console.log(`  Parsed ${region.key}: ${data.length} rows`);

  for (const row of data) {
    const mapsUrl = row.maps_url || "";
    const state = stateSeed[mapsUrl] || {};

    allRows.push({
      name: row.name || null,
      metier: row.metier || null,
      phone: row.phone || null,
      ville: row.ville || null,
      departement: row.departement || null,
      region: region.key,
      region_label: region.label,
      rating: parseRating(row.rating),
      reviews: parseReviews(row.reviews),
      hours_status: row.hours_status || null,
      address: row.address || null,
      maps_url: mapsUrl,
      siret: row.siret || null,
      naf_code: row.naf_code || null,
      company_created_at: parseDate(row.created_at),
      age_years: parseAge(row.age_years),
      legal_status: row.legal_status || null,
      status: state.status || "todo",
      notes: state.notes || "",
    });
  }
}

console.log(`\nTotal prospects to upsert: ${allRows.length}`);

// ── upsert prospects in batches ─────────────────────────────────────────
let upserted = 0;
const mapsUrlToId = new Map();

for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
  const batch = allRows.slice(i, i + BATCH_SIZE);
  const { data, error } = await supabase
    .from("prospects")
    .upsert(batch, { onConflict: "maps_url" })
    .select("id, maps_url");

  if (error) {
    console.error(`  Batch ${i / BATCH_SIZE + 1} error:`, error.message);
    continue;
  }

  // Build maps_url -> id lookup for call history migration
  for (const row of data) {
    mapsUrlToId.set(row.maps_url, row.id);
  }

  upserted += batch.length;
  console.log(
    `  Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${upserted}/${allRows.length}`,
  );
}

console.log(`\nProspects upserted: ${upserted}`);

// ── migrate call history ────────────────────────────────────────────────
const callEntries = Object.entries(stateSeed).filter(
  ([, state]) => Array.isArray(state.callHistory) && state.callHistory.length,
);

if (callEntries.length === 0) {
  console.log("No call history to migrate.");
} else {
  console.log(
    `\nMigrating call history for ${callEntries.length} prospect(s)...`,
  );

  const callRows = [];

  for (const [mapsUrl, state] of callEntries) {
    const prospectId = mapsUrlToId.get(mapsUrl);
    if (!prospectId) {
      console.warn(`  No prospect found for maps_url: ${mapsUrl.slice(0, 80)}...`);
      continue;
    }

    for (const h of state.callHistory) {
      callRows.push({
        prospect_id: prospectId,
        called_at: h.at,
        status: h.status,
        duration: h.duration ?? null,
        note: h.note ?? null,
      });
    }
  }

  // Insert calls in batches
  let insertedCalls = 0;

  for (let i = 0; i < callRows.length; i += BATCH_SIZE) {
    const batch = callRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("calls").insert(batch);

    if (error) {
      console.error(`  Calls batch ${i / BATCH_SIZE + 1} error:`, error.message);
      continue;
    }

    insertedCalls += batch.length;
    console.log(
      `  Inserted calls batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertedCalls}/${callRows.length}`,
    );
  }

  console.log(`Calls inserted: ${insertedCalls}`);
}

console.log("\nMigration complete.");
