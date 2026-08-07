import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { ensureDailySelection, skipSelection, cancelContact, markLostFromSelection, refillStock, setNoSiteMin } from "@/app/lib/igSelection";

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
  action?: "skip" | "cancel" | "lost" | "refill" | "quota";
  account_id?: string;
  prospect_id?: string;
  reason?: string;
  no_site_min?: number;
}

/**
 * POST /api/instagram/selection
 *  { action: "skip", prospect_id, reason? } → écarte le prospect (pas de report demain)
 *  { action: "quota", no_site_min }         → règle le plancher « sans site » du compte
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

    // Compte injoignable découvert en ouvrant le profil, avant toute accroche :
    // un seul clic le passe « perdu » ET le sort de la journée.
    if (body.action === "lost") {
      if (!body.prospect_id) return NextResponse.json({ error: "prospect_id requis" }, { status: 400 });
      await markLostFromSelection(body.prospect_id, body.reason?.trim() || null);
      return NextResponse.json({ ok: true, selection: await ensureDailySelection(body.account_id) });
    }

    // Plancher « sans site » du jour. Le réglage vit sur le compte (donc en
    // base) parce que le cron du matin compose la sélection bien avant qu'un
    // navigateur ne l'ouvre. La sélection est renvoyée recalculée : baisser le
    // plancher doit combler les créneaux tout de suite, pas demain.
    if (body.action === "quota") {
      if (typeof body.no_site_min !== "number") return NextResponse.json({ error: "no_site_min requis" }, { status: 400 });
      const noSiteMin = await setNoSiteMin(body.account_id, body.no_site_min);
      return NextResponse.json({ ok: true, noSiteMin, selection: await ensureDailySelection(body.account_id) });
    }

    if (body.action === "refill") {
      // Passe COURTE : le client « Aller en chercher » relance automatiquement
      // tant qu'il reste des créneaux. Une requête qui revient vite (~30-40 s)
      // ne meurt pas sur mobile ni sur le garde-fou navigateur de 100 s. La
      // résolution est bornée serré (peu de profils, temps court) car chaque
      // appel looter peut traîner. Le cron, lui, garde les longues bornes.
      const refill = await refillStock(new Date(), {
        budgetMs: 45_000,
        maxSteps: 2,
        stepReserveMs: 20_000,
        resolveLimit: 8,
        resolveBudgetMs: 30_000,
      });
      return NextResponse.json({ ok: true, refill, selection: await ensureDailySelection(body.account_id) });
    }

    return NextResponse.json({ error: "action inconnue (skip | cancel | lost | quota | refill)" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
