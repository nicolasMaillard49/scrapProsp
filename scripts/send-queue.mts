// File d'envoi du jour : top N prospects « todo » par score décroissant,
// avec trame suggérée et message M1 exact (même code que le cockpit).
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
  .limit(60);
if (error) throw new Error(error.message);

const queue = (data ?? [])
  .filter((l) => l.qualification !== "rejected")
  .slice(0, N)
  .map((l) => {
    const metierEff =
      detectMetier(l.profession_ia, null) || detectMetier(l.category, `${l.username} ${l.bio ?? ""}`) || l.metier || "";
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
