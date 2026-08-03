import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { buildTrame, TRAME_COLUMNS, type TrameProspect } from "@/app/lib/igTrame";
import { getAccountsWithCounters } from "@/app/lib/igCockpit";

export const dynamic = "force-dynamic";

/**
 * GET /api/instagram/trame?username=<u>
 * Unique source de données de l'extension Chrome (side panel trame DM).
 * Prospect inconnu → prospect:null + trame générique (le panneau propose
 * l'ajout). Auth : cookie OU en-tête x-ext-token (middleware).
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const username = (req.nextUrl.searchParams.get("username") ?? "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();

  try {
    const [prospectRes, accounts] = await Promise.all([
      username
        ? supabase.from("instagram_prospects").select(TRAME_COLUMNS).ilike("username", username).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      getAccountsWithCounters(new Date()),
    ]);
    if (prospectRes.error) return NextResponse.json({ error: prospectRes.error.message }, { status: 500 });

    const payload = buildTrame((prospectRes.data as TrameProspect | null) ?? null, req.nextUrl.origin);
    return NextResponse.json({
      ...payload,
      accounts: accounts.map((a) => ({
        id: a.id,
        username: a.username,
        sentDay: a.sentDay,
        daily: a.caps.daily,
        canSend: a.caps.daily > 0 && a.sentDay < a.caps.daily,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
