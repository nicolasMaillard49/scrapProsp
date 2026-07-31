import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { sendCockpitDigest, type DigestSelection } from "@/app/lib/igCockpit";
import { ensureDailySelection, refillStock } from "@/app/lib/igSelection";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // le refill enchaîne un scan Apify et des lots Claude

/**
 * /api/cron/ig-digest — prépare la journée puis envoie le récap Telegram.
 *  1. sélection du jour : report des non-traités d'hier + complétion (stock qualifié IA) ;
 *  2. créneaux encore vides → refill (tri IA du stock, sinon scan d'un hashtag neuf) ;
 *  3. récap Telegram, sélection en tête.
 * Auth : x-cron-secret == CRON_SECRET (cron VPS, POST) ou
 *        Authorization: Bearer CRON_SECRET (cron Vercel, GET) — même secret.
 * Programmé à 6 h UTC (≈ 8 h Paris l'été = début de la fenêtre d'envoi).
 * ?dry=1 : prépare la sélection SANS poster sur Telegram ni lancer de refill.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized =
    !!secret &&
    (req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`);
  if (!authorized) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const dry = req.nextUrl.searchParams.get("dry") === "1";

  try {
    let selection = await ensureDailySelection();
    let refillNote: string | undefined;

    // Stock épuisé → on trie d'abord ce qui dort en base, et seulement ensuite
    // on paie un nouveau scan (voir refillStock ; la source est choisie par
    // igSource, Apify puis relais RapidAPI).
    if (selection.shortfall > 0 && !dry) {
      const refill = await refillStock();
      refillNote = !refill.ran
        ? `Rien à faire : ${refill.reason}`
        : refill.mode === "qualify"
          ? `Tri IA du stock ${refill.metier} : ${refill.processed} passés en revue, ${refill.qualified} retenus.`
          : `Scan #${refill.hashtag} (${refill.metier}) : ${refill.inserted} nouveaux, ${refill.qualified} retenus.` +
            (refill.source ? ` ⚠️ Apify indisponible — relais « ${refill.source} » (quota gratuit, court).` : "");
      if (refill.ran) selection = await ensureDailySelection();
    }

    const digest: DigestSelection = {
      total: selection.rows.filter((r) => !r.skipped_at).length,
      restants: selection.rows.filter((r) => !r.done_at && !r.skipped_at).length,
      reportes: selection.carried,
      manquants: selection.shortfall,
      refill: refillNote,
    };
    if (dry) return NextResponse.json({ dry: true, selection: digest });

    const text = await sendCockpitDigest(new Date(), digest);
    return NextResponse.json({ ok: true, selection: digest, text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
