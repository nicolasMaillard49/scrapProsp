// Recalcule le champ `metier` des prospects Instagram existants avec les
// règles corrigées de detectMetier (artisans du bâtiment prioritaires —
// fini les paysagistes classés « esthéticienne » à cause de « beauté/spa »
// dans la bio). La profession IA, plus précise, prime quand elle existe.
//
// Dry-run par défaut : npx tsx scripts/backfill-metier.mts
// Application réelle : npx tsx scripts/backfill-metier.mts --apply
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
  category: string | null;
  bio: string | null;
  metier: string | null;
  profession_ia: string | null;
}

const { data, error } = await sb
  .from("instagram_prospects")
  .select("id, username, category, bio, metier, profession_ia")
  .limit(10_000);
if (error) throw new Error(error.message);

let changed = 0;
for (const r of (data ?? []) as Row[]) {
  // La profession IA (précise) prime ; sinon on redétecte depuis catégorie +
  // pseudo + bio (beaucoup de comptes n'ont le métier que dans leur nom).
  const next =
    detectMetier(r.profession_ia, null) || detectMetier(r.category, `${r.username} ${r.bio ?? ""}`) || null;
  const cur = r.metier || null;
  if (next === cur) continue;
  changed++;
  console.log(`@${r.username}: ${cur ?? "∅"} → ${next ?? "∅"}${r.profession_ia ? ` (IA: ${r.profession_ia})` : ""}`);
  if (APPLY) {
    const { error: upErr } = await sb.from("instagram_prospects").update({ metier: next }).eq("id", r.id);
    if (upErr) console.error(`  !! ${upErr.message}`);
  }
}
console.log(`\n${changed} prospect(s) à corriger sur ${data?.length ?? 0}${APPLY ? " — APPLIQUÉ" : " — dry-run (relance avec --apply)"}`);
