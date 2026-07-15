import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { parisDayStart } from "@/app/lib/igCockpit";

export const dynamic = "force-dynamic";

/**
 * /api/cron/kpi-slack — bilan prospection IG du JOUR (jour Paris), posté dans
 * le canal Slack #04-kpis (workspace Generate.io) via webhook entrant.
 * Auth : x-cron-secret == CRON_SECRET (cron VPS, POST) ou
 *        Authorization: Bearer CRON_SECRET (cron Vercel, GET) — même secret.
 * Env  : SLACK_KPI_WEBHOOK_URL (webhook entrant Slack du canal).
 * ?dry=1 : renvoie le message sans le poster (test).
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized =
    !!secret &&
    (req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`);
  if (!authorized) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const now = new Date();
  const dayStart = parisDayStart(now).toISOString();

  const [{ data: logs, error: e1 }, { count: bookes, error: e2 }] = await Promise.all([
    supabase.from("ig_dm_log").select("step, prospect_id").gte("sent_at", dayStart).limit(10_000),
    supabase
      .from("instagram_prospects")
      .select("id", { count: "exact", head: true })
      .eq("stage", "call_booke")
      .gte("last_dm_at", dayStart),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });

  let sent = 0;
  let relances = 0;
  let pb = 0;
  let propositions = 0;
  let questionnaires = 0;
  // Un M≥2 n'est envoyé qu'après une réponse du prospect → proxy « conversations actives ».
  const repondants = new Set<string>();
  for (const r of (logs ?? []) as { step: string; prospect_id: string }[]) {
    if (r.step.startsWith("R")) relances++;
    else sent++;
    if (r.step !== "M1" && r.step.startsWith("M")) repondants.add(r.prospect_id);
    if (r.step === "M7") pb++;
    if (r.step === "M8") propositions++;
    if (r.step === "M9") questionnaires++;
  }

  const dateFr = now.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  const message = [
    `:bar_chart: *Bilan prospection IG du ${dateFr}*`,
    `:email: Messages envoyés : ${sent}`,
    `:repeat: Relances : ${relances}`,
    `:speech_balloon: Réponses (conversations actives) : ${repondants.size}`,
    `:dart: Problématique identifiée : ${pb}`,
    `:calendar: Propositions d'appel : ${propositions}`,
    `:clipboard: Questionnaires envoyés : ${questionnaires}`,
    `:telephone_receiver: Calls bookés : ${bookes ?? 0}`,
  ].join("\n");

  if (req.nextUrl.searchParams.get("dry") === "1") {
    return NextResponse.json({ dry: true, message });
  }

  const webhook = process.env.SLACK_KPI_WEBHOOK_URL;
  if (!webhook) return NextResponse.json({ error: "SLACK_KPI_WEBHOOK_URL non configuré" }, { status: 503 });

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: `Slack a répondu ${res.status}: ${await res.text()}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, message });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
