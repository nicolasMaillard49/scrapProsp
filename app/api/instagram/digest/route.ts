import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { telegramConfigured } from "@/app/lib/notify";
import { sendCockpitDigest } from "@/app/lib/igCockpit";

export const dynamic = "force-dynamic";

/** POST /api/instagram/digest — envoie le récap cockpit sur Telegram (bouton UI). */
export async function POST() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  if (!telegramConfigured) return NextResponse.json({ error: "Telegram non configuré (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)" }, { status: 503 });
  try {
    const text = await sendCockpitDigest();
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
