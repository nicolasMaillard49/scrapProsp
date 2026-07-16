// File d'envoi du jour : N prospects « todo », mélangés entre corps de métier
// (round-robin sur les métiers, chacun trié par score décroissant), avec trame
// suggérée et message M1 exact (même code que le cockpit).
//
//   npx tsx scripts/send-queue.mts 20                 # mix de tous les métiers
//   npx tsx scripts/send-queue.mts 20 plombier,macon  # restreint à ces métiers
//
// Sans round-robin, un tri par score pur sort N prospects du même métier
// (le stock penche fortement d'un côté) : on veut tester plusieurs secteurs
// en parallèle pour comparer leurs taux de réponse.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { instagramDmSequence, detectMetier, detectTrame } from "../app/lib/instagram";
import { shortCode } from "../app/lib/links";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const N = Number(process.argv[2] ?? 7);
const ONLY = (process.argv[3] ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const ORIGIN = "https://prospects.nmf-agence.com";
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!);

const { data: accounts, error: accErr } = await sb
  .from("ig_accounts")
  .select("id, username, status, started_at")
  .eq("username", "nmfagence");
if (accErr) throw new Error(accErr.message);
const account = accounts?.[0];

const { data, error } = await sb
  .from("instagram_prospects")
  .select("id, username, full_name, bio, category, metier, profession_ia, ville, booking_platform, score, score_tier, status, qualification")
  .eq("status", "todo")
  .order("score", { ascending: false, nullsFirst: false })
  .limit(500);
if (error) throw new Error(error.message);

/** Métier effectif (même résolution que le cockpit) ; "" si indétectable. */
const metierOf = (l: (typeof data)[number]) =>
  detectMetier(l.profession_ia, null) || detectMetier(l.category, `${l.username} ${l.bio ?? ""}`) || l.metier || "";

// Groupe par métier, chaque groupe restant trié par score (l'ordre du fetch).
const groupes = new Map<string, typeof data>();
for (const l of data ?? []) {
  if (l.qualification === "rejected") continue;
  const m = metierOf(l).toLowerCase() || "(inconnu)";
  if (ONLY.length && !ONLY.includes(m)) continue;
  if (!groupes.has(m)) groupes.set(m, []);
  groupes.get(m)!.push(l);
}

// Round-robin : un prospect par métier à tour de rôle, jusqu'à N.
// Les métiers à petit stock ne sont donc jamais écrasés par les gros.
const melange: NonNullable<typeof data> = [];
// « (inconnu) » en dernier : sans métier détecté le M1 est générique, donc plus faible.
const files = [...groupes.entries()].sort((a, b) => Number(a[0] === "(inconnu)") - Number(b[0] === "(inconnu)")).map(([, f]) => f);
for (let i = 0; melange.length < N && files.some((f) => f.length > i); i++) {
  for (const f of files) {
    if (melange.length >= N) break;
    if (f[i]) melange.push(f[i]);
  }
}

console.error(
  `Mix : ${[...groupes.entries()].map(([m, f]) => `${m}=${f.length}`).join(", ")} → ${melange.length} sélectionnés`,
);

const queue = melange.map((l) => {
  const metierEff = metierOf(l);
  const trame = detectTrame(l.full_name, l.bio);
  const steps = instagramDmSequence(
    {
      metier: metierEff,
      ville: l.ville ?? "",
      bookingPlatform: l.booking_platform,
      firstName: l.full_name ? l.full_name.split(/\s+/)[0] : null,
      professionIa: l.profession_ia,
    },
    `${ORIGIN}/di/${shortCode(l.id)}`,
    trame,
  );
  const m1 = steps.find((s) => s.step === "M1") ?? steps[0];
  return {
    id: l.id,
    username: l.username,
    full_name: l.full_name,
    score: l.score,
    tier: l.score_tier,
    metier: metierEff,
    trame,
    m1: m1.text,
    profile: `https://www.instagram.com/${l.username}/`,
  };
});

console.log(JSON.stringify({ account, queue }, null, 2));
