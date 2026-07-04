import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { sendCockpitDigest } from "@/app/lib/igCockpit";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/ig-digest — récap Telegram du cockpit de prospection IG.
 * Auth : en-tête x-cron-secret == CRON_SECRET (même pattern que radar/run-blasts).
 * Cron VPS conseillé : tous les jours à 8 h (début de la fenêtre d'envoi).
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  try {
    const text = await sendCockpitDigest();
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
