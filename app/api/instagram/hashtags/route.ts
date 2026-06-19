import { NextRequest, NextResponse } from "next/server";
import { generateHashtags } from "@/app/lib/hashtags";

export const dynamic = "force-dynamic";

const MAX_TOWNS = 300; // borne la réponse (et le nb de hashtags candidats)

interface Body {
  metier?: string;
  departments?: string[];
  limitTowns?: number;
}

/**
 * POST /api/instagram/hashtags  { metier, departments?, limitTowns? }
 * Génère les hashtags « métier × petites villes FR » (≤100k hab). Sert côté serveur
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

  const departments = Array.isArray(body.departments)
    ? body.departments.map((d) => String(d).trim()).filter(Boolean)
    : undefined;
  const limitTowns = Math.min(Math.max(Number(body.limitTowns) || 100, 1), MAX_TOWNS);

  const rows = generateHashtags(metier, { departments, limitTowns });
  return NextResponse.json({ metier, count: rows.length, towns: limitTowns, rows });
}
