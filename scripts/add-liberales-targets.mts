// Déclare les professions libérales comme cibles de chasse (ig_hunt_targets).
//
//   npx tsx scripts/add-liberales-targets.mts          # aperçu, n'écrit rien
//   npx tsx scripts/add-liberales-targets.mts --apply  # écrit
//
// Sans ces lignes, les 14 niches ajoutées le 02/08 ne seront JAMAIS scannées :
// le refill ne chasse que ce qui est déclaré actif ici.
//
// Le plafond d'abonnés est le même que pour les artisans (2500) : au-delà on
// tombe sur des comptes de contenu — le « psy influenceur », la diététicienne
// à 50 k — qui ne sont pas des cabinets locaux et ne convertissent pas.

import { readFileSync } from "fs";
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  process.env[t.slice(0, eq).trim()] ??= t.slice(eq + 1).trim();
}

const apply = process.argv.includes("--apply");
const { supabase } = await import("../app/lib/supabase.ts");

/** `avatar_profession` sert de consigne à la qualification IA : elle doit décrire
 *  le PROFESSIONNEL cherché, pas seulement le mot-clé. */
const CIBLES: { metier: string; avatar: string }[] = [
  { metier: "kine", avatar: "masseur-kinésithérapeute libéral en cabinet" },
  { metier: "osteopathe", avatar: "ostéopathe D.O. en cabinet" },
  { metier: "podologue", avatar: "pédicure-podologue en cabinet" },
  { metier: "orthophoniste", avatar: "orthophoniste libéral en cabinet" },
  { metier: "sagefemme", avatar: "sage-femme libérale" },
  { metier: "dentiste", avatar: "chirurgien-dentiste en cabinet dentaire" },
  { metier: "medecin", avatar: "médecin généraliste en cabinet ou maison de santé" },
  { metier: "veterinaire", avatar: "vétérinaire en clinique ou cabinet" },
  { metier: "psychologue", avatar: "psychologue ou psychothérapeute en cabinet" },
  { metier: "dieteticien", avatar: "diététicien-nutritionniste en cabinet" },
  { metier: "sophrologue", avatar: "sophrologue ou naturopathe en cabinet" },
  { metier: "avocat", avatar: "avocat en cabinet, inscrit à un barreau" },
  { metier: "notaire", avatar: "notaire en étude notariale" },
  { metier: "expertcomptable", avatar: "expert-comptable en cabinet" },
];

const { data: existantes } = await supabase.from("ig_hunt_targets").select("metier, active");
const deja = new Map((existantes ?? []).map((r) => [r.metier as string, r.active as boolean]));

const aCreer = CIBLES.filter((c) => !deja.has(c.metier));
const aReactiver = CIBLES.filter((c) => deja.get(c.metier) === false);

console.log(`cibles existantes : ${deja.size}`);
console.log(`à créer           : ${aCreer.length} → ${aCreer.map((c) => c.metier).join(", ") || "—"}`);
console.log(`à réactiver       : ${aReactiver.length} → ${aReactiver.map((c) => c.metier).join(", ") || "—"}`);

if (!apply) {
  console.log("\n(aperçu seul — relancer avec --apply pour écrire)");
  process.exit(0);
}

const { error } = await supabase.from("ig_hunt_targets").upsert(
  CIBLES.map((c) => ({
    metier: c.metier,
    avatar_profession: c.avatar,
    min_followers: 0,
    max_followers: 2500,
    active: true,
  })),
  { onConflict: "metier" },
);
if (error) {
  console.error("❌ échec :", error.message);
  process.exit(1);
}

const { count } = await supabase.from("ig_hunt_targets").select("*", { count: "exact", head: true }).eq("active", true);
console.log(`\n✓ ${CIBLES.length} professions libérales déclarées — ${count} cibles actives au total.`);
console.log("ℹ Elles ont last_scan_at NULL : le refill les servira EN PREMIER (ordre : jamais scanné d'abord).");
