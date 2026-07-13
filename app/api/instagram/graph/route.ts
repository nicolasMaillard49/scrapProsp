import { NextResponse } from "next/server";
import {
  instagramGraphConfigured,
  getAccount,
  getMedia,
  getAccountInsights,
} from "@/app/lib/instagramGraph";

export const dynamic = "force-dynamic";

/**
 * GET /api/instagram/graph — état du compte @nmfagence via l'API Graph :
 * profil, derniers médias (avec stats) et insights compte. Lecture seule.
 */
export async function GET() {
  if (!instagramGraphConfigured) {
    return NextResponse.json({ error: "IG Graph non configuré (IG_GRAPH_ACCESS_TOKEN / IG_GRAPH_USER_ID)" }, { status: 503 });
  }
  try {
    const [account, media, insights] = await Promise.all([
      getAccount(),
      getMedia(12),
      getAccountInsights(["reach", "profile_views", "follower_count"], "day").catch(() => []),
    ]);
    return NextResponse.json({ account, media, insights });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
