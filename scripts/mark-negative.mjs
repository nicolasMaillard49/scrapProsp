// Mark a list of prospects (by phone) as "negative" + log a call.
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
//   node scripts/mark-negative.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing env vars NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Each entry: [display name, phone]. Phone matching is done on digits only,
// so spacing/punctuation differences with the DB don't matter.
const TARGETS = [
  ["ML PLOMBERIE", "06 20 51 53 43"],
  ["JDt plomberie", "07 52 62 30 78"],
  ["D.C plomberie", "07 49 89 75 18"],
  ["DV Plomberie", "06 23 33 58 70"],
  ["LAMELEC 19", "06 29 32 02 81"],
  ["Art'elec19", "06 83 06 43 73"],
  ["DELORD ELECTRICITE RENOVATION", "06 58 14 37 86"],
  ["F.L EOS ELEC", "07 88 28 80 66"],
  ["MC ELEC", "07 70 04 15 22"],
  ["Volt-Tec", "06 73 03 49 38"],
  ["THD électricité", "06 70 44 61 05"],
  ["Fabien Electricien", "07 81 91 00 52"],
  ["OUAHB elec", "06 48 73 46 12"],
  ["Sa Elec", "06 38 41 85 87"],
  ["Soc Production Electricite Moulins", "05 49 68 49 42"],
  ["Electricité générale", "07 62 40 71 73"],
  ["Actibat Groupe électricité", "07 80 00 51 67"],
  ["Elec +", "07 84 91 12 57"],
  ["Bastiaan Defize électricien", "06 65 45 82 27"],
  ["NOVATECH 19", "05 64 72 34 99"],
  ["E.U.R.L Arnaud NAOUAR", "06 75 65 96 41"],
  ["EURL Ruhier", "06 76 60 71 08"],
  ["Eurl -Charpentier-", "03 86 95 29 41"],
  ["btp-multiservices", "06 37 39 16 29"],
  ["Thibaut Clement Energies", "06 12 88 79 30"],
  ["CQFD 19", "06 38 79 69 00"],
  ["Alternatives Energies", "06 81 68 10 59"],
  ["Apc Lavialle", "07 60 64 35 07"],
  ["Prat Confort Services", "03 86 54 44 18"],
  ["Chez Cyloé", "06 68 82 74 25"],
  ["Tylinski Christophe SARL", "04 71 60 10 48"],
  ["Cofely", "04 71 60 16 33"],
  ["Établissements Valiere", "06 19 11 47 28"],
  ["Bonvalet Intervention", "07 87 03 34 37"],
  ["Établissement Giano", "06 59 65 79 98"],
  ["El Merabet Mohamed", "04 43 23 45 79"],
  ["Boudon Richard", "09 64 44 59 30"],
  ["Pommier Jean-Marie", "03 86 84 23 21"],
];

function digits(s) {
  return (s ?? "").replace(/\D+/g, "");
}

// ── Fetch all prospects once, then match on digit-only phone ──────────────
const { data: prospects, error } = await supabase
  .from("prospects")
  .select("id, name, phone, status");

if (error) {
  console.error("Failed to fetch prospects:", error.message);
  process.exit(1);
}

const byPhone = new Map();
for (const p of prospects ?? []) {
  const key = digits(p.phone);
  if (!key) continue;
  if (!byPhone.has(key)) byPhone.set(key, []);
  byPhone.get(key).push(p);
}

const now = new Date().toISOString();
const matched = [];
const missing = [];

for (const [label, phone] of TARGETS) {
  const key = digits(phone);
  const candidates = byPhone.get(key);
  if (!candidates || candidates.length === 0) {
    missing.push({ label, phone });
    continue;
  }
  for (const c of candidates) matched.push({ label, phone, prospect: c });
}

console.log(`Targets: ${TARGETS.length}`);
console.log(`Matched prospects: ${matched.length}`);
console.log(`Missing (no DB row): ${missing.length}`);
if (missing.length) {
  for (const m of missing) console.log(`  - ${m.label} (${m.phone})`);
}

if (matched.length === 0) {
  console.log("Nothing to update.");
  process.exit(0);
}

// ── Update prospect status to "negative" ──────────────────────────────────
const ids = [...new Set(matched.map((m) => m.prospect.id))];

const { error: updErr } = await supabase
  .from("prospects")
  .update({ status: "negative" })
  .in("id", ids);

if (updErr) {
  console.error("Failed to update prospect statuses:", updErr.message);
  process.exit(1);
}
console.log(`Updated status=negative on ${ids.length} prospect(s).`);

// ── Insert one "negative" call per prospect ───────────────────────────────
const callRows = ids.map((id) => ({
  prospect_id: id,
  called_at: now,
  status: "negative",
  duration: null,
  note: null,
}));

const { error: callErr } = await supabase.from("calls").insert(callRows);
if (callErr) {
  console.error("Failed to insert call rows:", callErr.message);
  process.exit(1);
}
console.log(`Inserted ${callRows.length} call record(s).`);

console.log("\nDone.");
for (const m of matched) {
  console.log(`  ✓ ${m.label} (${m.phone}) → ${m.prospect.name}`);
}
