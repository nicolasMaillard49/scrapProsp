// Backfill du champ `ville` des prospects Instagram qui n'en ont pas.
// Deux passes :
//   1. detectVille (liste CITIES) sur pseudo + bio — gratuit, instantané.
//   2. Claude Haiku en batch pour le reste — extrait la ville depuis pseudo +
//      full_name + bio (gère « 📍 Dordogne & Lot », « Attin 62170 », et le
//      suffixe département des pseudos : bois_et_jardins83 → Var → Toulon).
// Ne remplit QUE les villes vides (ne réécrit jamais une ville déjà posée).
// Débloque le rapport concurrentiel (qui exige une ville).
//
// Dry-run par défaut : npx tsx scripts/backfill-ville.mts
// Application réelle : npx tsx scripts/backfill-ville.mts --apply
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { detectVille } from "../app/lib/instagram";

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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!);
const MODEL = env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const ai = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

interface Row {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  ville: string | null;
}

const { data, error } = await sb
  .from("instagram_prospects")
  .select("id, username, full_name, bio, ville")
  .limit(10_000);
if (error) throw new Error(error.message);

const rows = (data ?? []) as Row[];
const empties = rows.filter((r) => !(r.ville && r.ville.trim()));

// ── Passe 1 : detectVille (gratuit) ─────────────────────────────────────────
const resolved = new Map<string, { ville: string; source: string }>();
const remaining: Row[] = [];
for (const r of empties) {
  const v = detectVille(r.username, `${r.full_name ?? ""} ${r.bio ?? ""}`);
  if (v) resolved.set(r.id, { ville: v, source: "rule" });
  else remaining.push(r);
}

// ── Passe 2 : Claude Haiku en batch ─────────────────────────────────────────
// Retire les surrogates UTF-16 orphelins (emojis tronqués dans certaines bios) :
// sinon le corps JSON de la requête Anthropic est invalide → 400.
const clean = (s: string) =>
  (s || "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function llmBatch(batch: Row[]): Promise<Record<string, string>> {
  if (!ai) return {};
  // clean() APRÈS le slice : couper à 200 peut scinder une paire surrogate valide
  // et recréer un orphelin — on nettoie donc la tranche finale.
  const list = batch.map((r, i) => `${i}. pseudo="${clean(r.username)}" nom="${clean(r.full_name ?? "")}" bio="${clean((r.bio ?? "").slice(0, 200))}"`).join("\n");
  const prompt =
    `Tu extrais la VILLE française où chaque artisan exerce, pour une recherche Google Maps.\n` +
    `Règles :\n` +
    `- Renvoie une VILLE précise si identifiable (ex: "Biarritz", "Toulouse").\n` +
    `- "📍 Dordogne & Lot" ou un nom de département → la préfecture (Dordogne→Périgueux).\n` +
    `- Un code postal (ex "62170") ou un nombre à 2 chiffres en fin de pseudo = numéro de département FR (83=Var→Toulon, 31=Haute-Garonne→Toulouse, 44=Loire-Atlantique→Nantes, 60=Oise→Beauvais, 84=Vaucluse→Avignon…) → la préfecture du département.\n` +
    `- Aucune localisation trouvable → "".\n` +
    `- Ne DEVINE pas au hasard : dans le doute, "".\n\n` +
    `Réponds UNIQUEMENT avec un tableau JSON [{"i":0,"ville":"..."}, ...], une entrée par ligne.\n\n${list}`;
  const res = await ai.messages.create({ model: MODEL, max_tokens: 1024, messages: [{ role: "user", content: prompt }] });
  const txt = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) return {};
  const out: Record<string, string> = {};
  try {
    for (const e of JSON.parse(m[0]) as { i: number; ville: string }[]) {
      const r = batch[e.i];
      if (r && e.ville && e.ville.trim()) out[r.id] = e.ville.trim();
    }
  } catch {
    /* batch illisible : ignoré */
  }
  return out;
}

if (ai && remaining.length) {
  console.error(`Passe LLM (${MODEL}) sur ${remaining.length} prospects…`);
  const SIZE = 15;
  for (let i = 0; i < remaining.length; i += SIZE) {
    const batch = remaining.slice(i, i + SIZE);
    try {
      const got = await llmBatch(batch);
      for (const r of batch) if (got[r.id]) resolved.set(r.id, { ville: got[r.id], source: "llm" });
    } catch (e) {
      console.error(`  !! batch ${i}-${i + SIZE} ignoré : ${e instanceof Error ? e.message : e}`);
    }
    console.error(`  …${Math.min(i + SIZE, remaining.length)}/${remaining.length}`);
  }
} else if (!ai) {
  console.error("(ANTHROPIC_API_KEY absent : passe LLM sautée — seul detectVille tourne.)");
}

// ── Écriture ────────────────────────────────────────────────────────────────
let ruleN = 0;
let llmN = 0;
for (const r of empties) {
  const hit = resolved.get(r.id);
  if (!hit) continue;
  hit.source === "rule" ? ruleN++ : llmN++;
  console.log(`@${r.username}: ∅ → ${hit.ville} [${hit.source}]`);
  if (APPLY) {
    const { error: upErr } = await sb.from("instagram_prospects").update({ ville: hit.ville }).eq("id", r.id);
    if (upErr) console.error(`  !! ${upErr.message}`);
  }
}

const miss = empties.length - resolved.size;
console.log("");
console.log(`${rows.length} prospects · ${rows.length - empties.length} avaient une ville · ${empties.length} vides`);
console.log(`→ ${resolved.size} détectées (${ruleN} règle + ${llmN} LLM) · ${miss} introuvables${APPLY ? " — APPLIQUÉ" : " — dry-run (relance avec --apply)"}`);
