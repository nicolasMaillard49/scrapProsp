import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 3600_000;

/** Jour civil Europe/Paris (YYYY-MM-DD) d'un timestamp ISO. */
function parisDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

/** Heure (0-23, Europe/Paris) d'un timestamp ISO. */
function parisHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", hour: "numeric", hour12: false }).format(new Date(iso)),
  ) % 24;
}

interface DayKpi {
  sent: number; // messages M1-M9
  relances: number; // R1-R3
  pb: number; // arrivées à la problématique (M7 envoyés)
  propositions: number; // propositions d'appel (M8 envoyés)
  bookes: number; // prospects passés « call booké » (proxy : dernier DM ce jour-là)
  hmin: number | null;
  hmax: number | null;
}

/**
 * GET /api/instagram/kpi?days=N — agrégats JOURNALIERS de la prospection IG
 * pour le tableau de tracking Google Sheets (Apps Script).
 * Volontairement public : uniquement des compteurs, aucune donnée nominative.
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const days = Math.min(31, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 3));
  const since = new Date(Date.now() - days * DAY_MS).toISOString();

  const [{ data: logs, error: e1 }, { data: booked, error: e2 }] = await Promise.all([
    supabase.from("ig_dm_log").select("step, sent_at").gte("sent_at", since).limit(10_000),
    supabase
      .from("instagram_prospects")
      .select("last_dm_at")
      .eq("stage", "call_booke")
      .gte("last_dm_at", since)
      .limit(10_000),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });

  const map = new Map<string, DayKpi>();
  const day = (d: string): DayKpi => {
    if (!map.has(d)) map.set(d, { sent: 0, relances: 0, pb: 0, propositions: 0, bookes: 0, hmin: null, hmax: null });
    return map.get(d)!;
  };

  for (const r of (logs ?? []) as { step: string; sent_at: string }[]) {
    const d = day(parisDate(r.sent_at));
    if (r.step.startsWith("R")) d.relances++;
    else d.sent++;
    if (r.step === "M7") d.pb++;
    if (r.step === "M8") d.propositions++;
    const h = parisHour(r.sent_at);
    d.hmin = d.hmin === null ? h : Math.min(d.hmin, h);
    d.hmax = d.hmax === null ? h : Math.max(d.hmax, h);
  }
  for (const r of (booked ?? []) as { last_dm_at: string | null }[]) {
    if (r.last_dm_at) day(parisDate(r.last_dm_at)).bookes++;
  }

  const out = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      sent: v.sent,
      relances: v.relances,
      heures: v.hmin === null ? "" : v.hmin === v.hmax ? `${v.hmin}h` : `${v.hmin}h-${v.hmax}h`,
      pb: v.pb,
      propositions: v.propositions,
      bookes: v.bookes,
    }));
  return NextResponse.json({ days: out });
}
