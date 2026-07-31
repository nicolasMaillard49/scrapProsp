import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { apifyConfigured } from "@/app/lib/apify";
import { discoverHashtag } from "@/app/lib/igDiscover";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel : laisse le temps aux runs Apify

interface DiscoverBody {
  hashtag?: string;
  target?: number;
  dryRun?: boolean;
  keepAll?: boolean; // true = capture TOUS les profils (+ has_website), pas seulement les sans-site
}

/**
 * POST /api/instagram/discover  { hashtag, target?=100, dryRun?, keepAll? }
 * Découvre ~target comptes Instagram SANS site web pour un hashtag, via Apify.
 * Le moteur vit dans `app/lib/igDiscover.ts` (partagé avec le refill automatique
 * de la sélection du jour) ; cette route n'est que la façade HTTP.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  if (!apifyConfigured) return NextResponse.json({ error: "APIFY_TOKEN manquant" }, { status: 503 });

  let body: DiscoverBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!(body.hashtag ?? "").replace(/^#/, "").trim()) {
    return NextResponse.json({ error: "hashtag requis" }, { status: 400 });
  }

  try {
    const out = await discoverHashtag({
      hashtag: body.hashtag!,
      target: body.target,
      dryRun: body.dryRun === true,
      keepAll: body.keepAll === true,
    });
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Hashtag scraper: ${msg}` }, { status: 502 });
  }
}
