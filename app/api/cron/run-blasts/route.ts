import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { runBlast, BlastError } from "@/app/lib/blast";

/** Base publique pour les liens démo (env obligatoire en prod). */
function demoBase(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_DEMO_BASE_URL;
  return env ? env.replace(/\/$/, "") : req.nextUrl.origin;
}

/**
 * Moteur des blasts programmés. Appelé chaque minute par le cron VPS.
 * Auth : en-tête x-cron-secret == CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("scheduled_blasts")
    .select("id, limit_count")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const base = demoBase(req);
  const ran: Array<{ id: string; sent?: number; failed?: number; error?: string }> = [];

  for (const job of due ?? []) {
    // Claim atomique : seul le tick qui passe pending->running exécute (anti-double-envoi).
    const { data: claimed } = await supabase
      .from("scheduled_blasts")
      .update({ status: "running" })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const r = await runBlast({ limit: job.limit_count, base });
      await supabase
        .from("scheduled_blasts")
        .update({ status: "done", executed_at: new Date().toISOString(), result: { sent: r.sent, failed: r.failed, totalSegments: r.totalSegments, pool: r.pool, targeted: r.targeted } })
        .eq("id", job.id);
      ran.push({ id: job.id, sent: r.sent, failed: r.failed });
    } catch (e) {
      // Hors créneau légal : on ne marque PAS failed — on remet pending pour
      // que le job reparte au prochain tick valide (8h-20h, hors dimanche).
      if (e instanceof BlastError && e.code === "OUT_OF_WINDOW") {
        await supabase.from("scheduled_blasts").update({ status: "pending" }).eq("id", job.id);
        ran.push({ id: job.id, error: "différé (hors créneau)" });
        continue;
      }
      const msg = e instanceof BlastError ? e.message : e instanceof Error ? e.message : String(e);
      await supabase
        .from("scheduled_blasts")
        .update({ status: "failed", executed_at: new Date().toISOString(), result: { error: msg } })
        .eq("id", job.id);
      ran.push({ id: job.id, error: msg });
    }
  }

  return NextResponse.json({ ran, count: ran.length });
}
