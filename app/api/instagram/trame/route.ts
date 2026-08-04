import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { buildTrame, TRAME_COLUMNS, type TrameProspect } from "@/app/lib/igTrame";
import { getAccountsWithCounters } from "@/app/lib/igCockpit";
import { resolveTrame } from "@/app/lib/igTrameChoice";

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
      // eq (pas ilike) : la colonne est UNIQUE + lowercase et le paramètre est
      // déjà toLowerCase() — ilike laisserait `_`/`%` agir comme joker SQL
      // (mauvais prospect renvoyé, ou 500 sur doublon de motif).
      username
        ? supabase.from("instagram_prospects").select(TRAME_COLUMNS).eq("username", username).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      getAccountsWithCounters(new Date()),
    ]);
    if (prospectRes.error) return NextResponse.json({ error: prospectRes.error.message }, { status: 500 });

    // Même motif que app/api/blast/route.ts : l'origin de la requête est
    // l'URL tapée dans les options de l'extension (localhost en dev) — le
    // lien de démo part dans un vrai DM, il ne doit jamais pointer dessus.
    const base = (process.env.NEXT_PUBLIC_DEMO_BASE_URL ?? "").replace(/\/$/, "") || req.nextUrl.origin;
    const prospect = (prospectRes.data as TrameProspect | null) ?? null;

    const trame = await resolveTrame(req.nextUrl.searchParams.get("trame"), prospect?.id ?? null);

    const payload = buildTrame(prospect, base, trame);
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
