import { NextResponse } from "next/server";
import {
  instagramGraphConfigured,
  getAccount,
  getMediaWithInsights,
  getAccountInsights,
} from "@/app/lib/instagramGraph";

export const dynamic = "force-dynamic";

/**
 * GET /api/instagram/graph — performance du compte @nmfagence via l'API Graph :
 * profil (followers/follows/média), posts enrichis d'insights (reach, saves,
 * engagement) triés du plus performant, et insights compte. Lecture seule.
 */
export async function GET() {
  if (!instagramGraphConfigured) {
    return NextResponse.json({ error: "IG Graph non configuré (IG_GRAPH_ACCESS_TOKEN / IG_GRAPH_USER_ID)" }, { status: 503 });
  }
  try {
    const [account, media, insights] = await Promise.all([
      getAccount(),
      getMediaWithInsights(12),
      getAccountInsights(["reach", "profile_views", "follower_count"], "day").catch(() => []),
    ]);
    return NextResponse.json({ account, media, insights });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
