// Repasse en « traiteur » les prospects Instagram rangés à tort en
// « restaurant » (ou laissés vides) avant que la niche traiteur existe.
//
// Volontairement PLUS ÉTROIT que backfill-metier.mts : celui-ci recalcule tout
// le fichier et déplacerait 200+ prospects sans rapport. Ici on ne touche un
// prospect QUE si la détection le range désormais en traiteur — un traiteur
// classé restaurant reçoit sinon une maquette de réservation de couverts, qui
// ne parle pas de son métier (il vend une date et un devis, pas une table).
//
// Dry-run par défaut : npx tsx scripts/backfill-traiteur.mts
// Application réelle : npx tsx scripts/backfill-traiteur.mts --apply
//
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { detectMetier } from "../app/lib/instagram";

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

interface Row {
  id: string;
  username: string;
  full_name: string | null;
  category: string | null;
  bio: string | null;
  metier: string | null;
  profession_ia: string | null;
}

// PostgREST plafonne une réponse à 1000 lignes : sans pagination, le fichier
// est tronqué et les prospects du fond passent à travers le backfill.
const PAGE = 1000;
const rows: Row[] = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb
    .from("instagram_prospects")
    .select("id, username, full_name, category, bio, metier, profession_ia")
    .order("id")
    .range(from, from + PAGE - 1);
  if (error) throw new Error(error.message);
  rows.push(...((data ?? []) as unknown as Row[]));
  if (!data || data.length < PAGE) break;
}

let changed = 0;
for (const r of rows) {
  if (r.metier === "traiteur") continue;
  // Le nom du compte compte autant que la bio : « Les Délices de Codé -
  // Traiteur » dit le métier là où la catégorie ne dit que « Caterer ».
  const next =
    detectMetier(r.profession_ia, null) ||
    detectMetier(r.category, `${r.username} ${r.full_name ?? ""} ${r.bio ?? ""}`);
  if (next !== "traiteur") continue;
  changed++;
  console.log(`@${r.username}: ${r.metier ?? "∅"} → traiteur — ${r.full_name ?? ""}`);
  if (APPLY) {
    const { error: upErr } = await sb.from("instagram_prospects").update({ metier: "traiteur" }).eq("id", r.id);
    if (upErr) console.error(`  !! ${upErr.message}`);
  }
}
console.log(`\n${changed} prospect(s) → traiteur sur ${rows.length}${APPLY ? " — APPLIQUÉ" : " — dry-run (relance avec --apply)"}`);
