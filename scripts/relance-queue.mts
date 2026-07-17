// File des relances dues : prospects « contacted » au stade « accroche » (pas de réponse),
// dont next_followup_at est échu, avec le step R1/R2/R3 selon followup_count et le texte exact.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { instagramDmSequence, detectMetier, firstNameOf } from "../app/lib/instagram";
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

const ORIGIN = "https://prospects.nmf-agence.com";
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!);
const nowIso = new Date().toISOString();

const { data, error } = await sb
  .from("instagram_prospects")
  .select("id, username, full_name, bio, category, metier, profession_ia, ville, booking_platform, score, status, stage, qualification, followup_count, next_followup_at, last_dm_at, contacted_by")
  .eq("status", "contacted")
  .eq("stage", "accroche")
  .lte("next_followup_at", nowIso)
  .order("next_followup_at", { ascending: true })
  .limit(60);
if (error) throw new Error(error.message);

const R_BY_COUNT: Record<number, string> = { 0: "R1" };

const queue = (data ?? [])
  .filter((l) => l.qualification !== "rejected")
  .filter((l) => (l.followup_count ?? 0) === 0) // R1 est la seule relance (cf. MAX_FOLLOWUPS)
  .map((l) => {
    const metierEff =
      detectMetier(l.profession_ia, null) || detectMetier(l.category, `${l.username} ${l.bio ?? ""}`) || l.metier || "";
    const steps = instagramDmSequence(
      {
        metier: metierEff,
        ville: l.ville ?? "",
        bookingPlatform: l.booking_platform,
        firstName: firstNameOf(l.full_name),
        professionIa: l.profession_ia,
      },
      `${ORIGIN}/di/${shortCode(l.id)}`,
    );
    const stepName = R_BY_COUNT[l.followup_count ?? 0];
    const step = steps.find((s) => s.step === stepName)!;
    return {
      id: l.id,
      username: l.username,
      full_name: l.full_name,
      followup_count: l.followup_count ?? 0,
      due: l.next_followup_at,
      last_dm_at: l.last_dm_at,
      step: stepName,
      text: step.text,
      profile: `https://www.instagram.com/${l.username}/`,
    };
  });

console.log(JSON.stringify({ count: queue.length, queue }, null, 2));
