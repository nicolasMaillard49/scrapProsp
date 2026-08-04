import { NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { parisDayStart, getStreak } from "@/app/lib/igCockpit";
import { isAccrocheStep, stageForStep } from "@/app/lib/igPipeline";

export const dynamic = "force-dynamic";

/**
 * GET /api/instagram/session — la journée en chiffres, et RIEN d'autre.
 *
 * Sert la carte de clôture du panneau : ce qui s'affiche quand la file du jour
 * est vide. La prospection est un métier sans applaudissement — la seule chose
 * qui fait revenir demain, c'est de voir la journée se fermer.
 *
 * Volontairement AGRÉGÉE : aucun pseudo, aucun extrait, aucun identifiant de
 * prospect. C'est ce qui permet de l'ouvrir à l'extension (`x-ext-token`)
 * là où /api/instagram/kpi/day, nominatif, restera toujours fermé.
 */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const now = new Date();
  const dayStart = parisDayStart(now).toISOString();

  try {
    const [logsRes, repliesRes, streak] = await Promise.all([
      supabase.from("ig_dm_log").select("step").gte("sent_at", dayStart).limit(5_000),
      supabase.from("ig_replies").select("kind").gte("received_at", dayStart).limit(5_000),
      getStreak(now),
    ]);
    if (logsRes.error) return NextResponse.json({ error: logsRes.error.message }, { status: 500 });

    const logs = (logsRes.data ?? []) as { step: string }[];
    const replies = (repliesRes.data ?? []) as { kind: string }[];

    let accroches = 0;
    let relances = 0;
    let propositions = 0;
    for (const r of logs) {
      if (isAccrocheStep(r.step)) accroches++;
      else if (r.step.startsWith("R")) relances++;
      if (stageForStep(r.step) === "appel_propose") propositions++;
    }

    // L'autorépondeur n'est pas une réponse humaine : le compter gonflerait le
    // seul chiffre qui juge vraiment l'accroche.
    const humaines = replies.filter((r) => r.kind !== "autorepondeur");

    return NextResponse.json({
      envois: logs.length,
      accroches,
      relances,
      propositions,
      reponses: humaines.length,
      positives: humaines.filter((r) => r.kind === "positive").length,
      refus: humaines.filter((r) => r.kind === "refus").length,
      streak: streak.current,
      record: streak.best,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
