import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { ensureDailySelection, skipSelection, cancelContact, refillStock } from "@/app/lib/igSelection";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // le refill enchaîne un scan Apify et des lots Claude

/**
 * GET /api/instagram/selection?account_id=…
 * Sélection du jour : la crée si elle n'existe pas (report des non-traités de la
 * veille + complétion avec le meilleur stock qualifié IA). Aucun appel externe :
 * une simple visite du cockpit ne déclenche jamais de dépense Apify.
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const accountId = req.nextUrl.searchParams.get("account_id") ?? undefined;
  try {
    return NextResponse.json(await ensureDailySelection(accountId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

interface Body {
  action?: "skip" | "cancel" | "refill";
  account_id?: string;
  prospect_id?: string;
  reason?: string;
}

/**
 * POST /api/instagram/selection
 *  { action: "skip", prospect_id, reason? } → écarte le prospect (pas de report demain)
 *  { action: "refill" }                     → scan hashtag + qualification IA, puis complète
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  try {
    if (body.action === "skip") {
      if (!body.prospect_id) return NextResponse.json({ error: "prospect_id requis" }, { status: 400 });
      await skipSelection(body.prospect_id, body.reason?.trim() || null);
      return NextResponse.json({ ok: true, selection: await ensureDailySelection(body.account_id) });
    }

    // Annule une accroche déjà marquée envoyée : purge le DM du journal (donc
    // des KPI) et sort le prospect du circuit. Pour les comptes injoignables ou
    // déjà démarchés hors outil, découverts après le clic « Prendre contact ».
    if (body.action === "cancel") {
      if (!body.prospect_id) return NextResponse.json({ error: "prospect_id requis" }, { status: 400 });
      await cancelContact(body.prospect_id, body.reason?.trim() || null);
      return NextResponse.json({ ok: true, selection: await ensureDailySelection(body.account_id) });
    }

    if (body.action === "refill") {
      const refill = await refillStock();
      return NextResponse.json({ ok: true, refill, selection: await ensureDailySelection(body.account_id) });
    }

    return NextResponse.json({ error: "action inconnue (skip | refill)" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
