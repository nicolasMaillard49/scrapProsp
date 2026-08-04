import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { buildCompetitorReport } from "@/app/lib/igCompetitor";
import { saveMapsFacts, toFacts, mapsHeadline, MAPS_COLUMNS } from "@/app/lib/igMaps";

export const dynamic = "force-dynamic";
// Le scrape Maps + les checks de tag Ads prennent plusieurs dizaines de secondes.
export const maxDuration = 300;

/**
 * POST /api/instagram/competitors  { username, refresh? }
 *
 * Le rapport concurrentiel, par PSEUDO — jumeau de /api/instagram/[id]/competitors,
 * qui lui prend un UUID.
 *
 * Pourquoi une seconde route plutôt qu'ouvrir la première à l'extension :
 * l'allowlist `extAuth` compare des chemins EXACTS, et pour de bonnes raisons
 * (un préfixe `/api/instagram/` ouvrirait aussi l'export nominatif et les
 * DELETE à un secret statique). Un chemin qui contient un identifiant ne peut
 * donc pas y figurer. Et le panneau ne connaît que le pseudo de toute façon :
 * c'est ce qu'Instagram affiche.
 *
 * Sans `refresh`, un rapport déjà en base est rendu tel quel — le scrape coûte
 * une à deux minutes, on ne le relance pas parce qu'on a rouvert le panneau.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  let body: { username?: string; refresh?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const username = (body.username ?? "").replace(/^@/, "").trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "username requis" }, { status: 400 });

  const { data: p } = await supabase
    .from("instagram_prospects")
    .select(`id, username, full_name, metier, profession_ia, ville, ${MAPS_COLUMNS}`)
    .eq("username", username)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: "Prospect hors base — capte-le d'abord." }, { status: 404 });

  const row = p as Record<string, unknown>;
  const metier = String(row.profession_ia || row.metier || "").trim();
  const ville = String(row.ville || "").trim();
  if (!metier || !ville) {
    const manque = !metier && !ville ? "le métier et la ville" : !metier ? "le métier" : "la ville";
    return NextResponse.json(
      { error: `Il manque ${manque} sur ce prospect — impossible de le classer.` },
      { status: 422 },
    );
  }

  // Déjà relevé : on rend ce qu'on a. Une à deux minutes de scrape ne se
  // relancent pas parce qu'on a rouvert le panneau.
  const known = toFacts(row);
  if (known && !body.refresh) {
    return NextResponse.json({
      cached: true,
      headline: mapsHeadline(known, metier, ville),
      facts: known,
      competitors: null,
    });
  }

  try {
    const report = await buildCompetitorReport(
      {
        metier,
        ville,
        fullName: (row.full_name as string | null) ?? null,
        username: String(row.username),
      },
      // `quick` : le scrape complet dépasse la minute et le panneau attend.
      // Vingt concurrents suffisent largement à situer quelqu'un.
      { full: false },
    );
    await saveMapsFacts(String(row.id), report);

    const facts = {
      rank: report.selfRank,
      rating: report.self?.rating ?? null,
      reviews: report.self?.reviews ?? null,
      phone: report.self?.phone ?? null,
      address: report.self?.address ?? null,
      adsCount: report.adsCount,
      total: report.total,
      checkedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      cached: false,
      headline: mapsHeadline(facts, metier, ville),
      facts,
      // La comparaison elle-même : qui est devant, qui paie des Ads. Bornée à
      // dix — au-delà on ne compare plus, on lit un annuaire.
      competitors: report.competitors.slice(0, 10).map((c) => ({
        rank: c.rank,
        name: c.name,
        rating: c.rating,
        reviews: c.reviews,
        ads: c.ads,
        isSelf: c.isSelf,
      })),
      metier,
      ville,
    });
  } catch (e) {
    // Le scraper est un service à part (VPS) : son indisponibilité n'est pas
    // un bug de l'app, et le dire évite d'aller chercher au mauvais endroit.
    return NextResponse.json(
      { error: `Scraper injoignable ou trop lent : ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
