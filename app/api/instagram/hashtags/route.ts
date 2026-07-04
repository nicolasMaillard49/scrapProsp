import { NextRequest, NextResponse } from "next/server";
import { generateHashtags, generateMetierHashtags } from "@/app/lib/hashtags";

export const dynamic = "force-dynamic";

const MAX_TOWNS = 300; // borne la réponse (et le nb de hashtags candidats)

interface Body {
  metier?: string;
  departments?: string[];
  limitTowns?: number;
  /** "metier" = hashtags métier purs (les plus qualifiés, sans ville) ; "villes" = métier × petites villes (défaut). */
  mode?: "metier" | "villes";
  /** mode métier : inclure aussi les hashtags transversaux bâtiment/artisanat (gros volume, bruités). */
  includeTransversal?: boolean;
}

/**
 * POST /api/instagram/hashtags  { metier, mode?, departments?, limitTowns?, includeTransversal? }
 * mode "metier" : bibliothèque de hashtags métier purs (sans ville) — méthode hashtag directe.
 * mode "villes" : hashtags « métier × petites villes FR » (≤100k hab). Sert côté serveur
 * (le dataset communes ~450 Ko ne part jamais dans le bundle client).
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const metier = (body.metier ?? "").trim();
  if (!metier) return NextResponse.json({ error: "métier requis" }, { status: 400 });

  if (body.mode === "metier") {
    const rows = generateMetierHashtags(metier, { includeTransversal: body.includeTransversal === true });
    return NextResponse.json({ metier, mode: "metier", count: rows.length, rows });
  }

  const departments = Array.isArray(body.departments)
    ? body.departments.map((d) => String(d).trim()).filter(Boolean)
    : undefined;
  const limitTowns = Math.min(Math.max(Number(body.limitTowns) || 100, 1), MAX_TOWNS);

  const rows = generateHashtags(metier, { departments, limitTowns });
  return NextResponse.json({ metier, mode: "villes", count: rows.length, towns: limitTowns, rows });
}
