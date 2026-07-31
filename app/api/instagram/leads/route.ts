import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { igSourceConfigured } from "@/app/lib/igSource";
import { collectLeads, resolveLeads, leadsStatus, RESOLVE_BATCH } from "@/app/lib/igLeads";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/instagram/leads → état de la file + quota restant chez le fournisseur.
 * Aucune requête de scraping : ouvrir le cockpit ne coûte jamais un crédit.
 */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  try {
    return NextResponse.json(await leadsStatus());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

interface Body {
  action?: "collect" | "resolve";
  hashtag?: string;
  metier?: string;
  limit?: number;
}

/**
 * POST /api/instagram/leads
 *  { action: "collect", hashtag, metier? } → empile ~30 comptes en file (1 requête, rapide)
 *  { action: "resolve", limit?, metier? }  → transforme un lot de pistes en prospects
 *
 * Les deux sont bornés pour rendre la main bien avant le maxDuration : c'est
 * tout l'intérêt d'avoir séparé la découverte de la résolution.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  if (!igSourceConfigured) {
    return NextResponse.json({ error: "Aucune source Instagram configurée (APIFY_TOKEN ou RAPIDAPI_KEY)" }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  try {
    if (body.action === "collect") {
      if (!(body.hashtag ?? "").replace(/^#/, "").trim()) {
        return NextResponse.json({ error: "hashtag requis" }, { status: 400 });
      }
      const result = await collectLeads(body.hashtag!, body.metier?.trim() || null);
      return NextResponse.json({ ok: true, result, status: await leadsStatus() });
    }

    if (body.action === "resolve") {
      const limit = Math.min(Math.max(Number(body.limit) || RESOLVE_BATCH, 1), 40);
      const result = await resolveLeads(limit, body.metier?.trim() || null);
      return NextResponse.json({ ok: true, result, status: await leadsStatus() });
    }

    return NextResponse.json({ error: "action inconnue (collect | resolve)" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
