import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { igSourceConfigured } from "@/app/lib/igSource";
import { discoverHashtag } from "@/app/lib/igDiscover";
import { iglog } from "@/app/lib/igProviders/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel : laisse le temps aux runs de scraping

interface DiscoverBody {
  hashtag?: string;
  target?: number;
  dryRun?: boolean;
  keepAll?: boolean; // true = capture TOUS les profils (+ has_website), pas seulement les sans-site
}

/**
 * POST /api/instagram/discover  { hashtag, target?=100, dryRun?, keepAll? }
 * Découvre ~target comptes Instagram SANS site web pour un hashtag.
 * La source est choisie par `igSource` (Apify, puis relais RapidAPI).
 * Le moteur vit dans `app/lib/igDiscover.ts` (partagé avec le refill automatique
 * de la sélection du jour) ; cette route n'est que la façade HTTP.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  if (!igSourceConfigured) return NextResponse.json({ error: "Aucune source Instagram configurée (APIFY_TOKEN ou RAPIDAPI_KEY)" }, { status: 503 });

  let body: DiscoverBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!(body.hashtag ?? "").replace(/^#/, "").trim()) {
    return NextResponse.json({ error: "hashtag requis" }, { status: 400 });
  }

  iglog("step", "route", `POST /discover #${(body.hashtag ?? "").replace(/^#/, "").trim()} (target=${body.target ?? 100}, dryRun=${body.dryRun === true})`);
  try {
    const out = await discoverHashtag({
      hashtag: body.hashtag!,
      target: body.target,
      dryRun: body.dryRun === true,
      keepAll: body.keepAll === true,
    });
    iglog("ok", "route", `/discover terminé — source=${out.source?.provider ?? "?"}, scannés=${out.scanned}, qualifiés=${out.qualified}, insérés=${out.inserted}`);
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    iglog("err", "route", `/discover ÉCHEC`, { message: msg });
    return NextResponse.json({ error: `Hashtag scraper: ${msg}` }, { status: 502 });
  }
}
