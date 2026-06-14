import { NextRequest, NextResponse } from "next/server";
import { SCRAPER_URL } from "@/app/lib/competitor-config";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import {
  nameScore,
  normalizePhoneFR,
  phonesMatch,
  cityFromAddress,
} from "@/app/lib/match";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST /api/prospects/find  { phone?, name, sector }
 *
 * Ajout manuel : à partir d'un nom d'entreprise + secteur (+ téléphone facultatif),
 * on interroge le scraper Google Maps, on choisit le meilleur match, on l'enrichit
 * (tél / adresse / site) et on renvoie un APERÇU à valider avant insertion.
 * N'écrit rien en base — c'est /api/prospects/add qui insère.
 */

interface RawComp {
  name: string;
  rating: string;
  reviews: string;
  phone: string;
  address: string;
  website: string;
  maps_url: string;
  category: string;
}

async function scrape(metier: string, ville: string, limit = 6): Promise<RawComp[]> {
  const res = await fetch(SCRAPER_URL + "/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metier, ville, limit, quick: true }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`scraper ${res.status}`);
  const json = await res.json();
  return (json.competitors || []) as RawComp[];
}

async function enrich(
  maps_url: string,
): Promise<{ phone: string; address: string; website: string } | null> {
  try {
    const res = await fetch(SCRAPER_URL + "/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maps_url }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function parseRating(s: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}
function parseReviews(s: string): number | null {
  if (!s) return null;
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return isNaN(n) ? null : n;
}
function cleanWebsite(w: string): string | null {
  return w && /^https?:\/\/.+\..+/.test(w) ? w : null;
}

export async function POST(req: NextRequest) {
  let body: { phone?: string; name?: string; sector?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const phone = (body.phone || "").trim();
  const name = (body.name || "").trim();
  const sector = (body.sector || "").trim();

  if (!name || !sector) {
    return NextResponse.json(
      { error: "Nom de l'entreprise et secteur sont requis" },
      { status: 400 },
    );
  }

  // 1. Recherche principale : nom + secteur
  let candidates: RawComp[];
  try {
    candidates = await scrape(name, sector, 6);
  } catch (err) {
    return NextResponse.json(
      { error: "Scraper injoignable", details: String(err) },
      { status: 502 },
    );
  }

  let scored = candidates
    .filter((c) => c.name && c.maps_url)
    .map((c) => ({ c, score: nameScore(name, c.name) }))
    .sort((a, b) => b.score - a.score);

  // 2. Repli par téléphone si le meilleur match est faible
  if ((scored.length === 0 || scored[0].score < 0.5) && phone) {
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length >= 9) {
      try {
        const byPhone = await scrape(phoneDigits, sector || "France", 6);
        // En recherche par téléphone, Maps centre sur la bonne fiche : on
        // privilégie le 1er résultat tout en gardant le score de nom comme bonus.
        const phoneScored = byPhone
          .filter((c) => c.name && c.maps_url)
          .map((c, i) => ({
            c,
            score: Math.max(nameScore(name, c.name), i === 0 ? 0.55 : 0.3),
          }));
        scored = [...scored, ...phoneScored].sort((a, b) => b.score - a.score);
      } catch {
        /* le repli est best-effort */
      }
    }
  }

  const best = scored[0];
  if (!best || best.score < 0.25) {
    return NextResponse.json({ found: false });
  }

  // 3. Enrichissement (tél / adresse / site) du meilleur match.
  // Une fiche unique (place page) arrive déjà enrichie → on évite un /enrich
  // redondant (~10 s). On n'enrichit que si tél ou adresse manquent.
  const needEnrich = !best.c.phone || !best.c.address;
  const enriched = needEnrich ? await enrich(best.c.maps_url) : null;
  const foundPhone = best.c.phone || enriched?.phone || "";
  const address = best.c.address || enriched?.address || "";
  const website = cleanWebsite(best.c.website || enriched?.website || "");
  const ville = cityFromAddress(address);

  const phoneMatch = phone && foundPhone ? phonesMatch(phone, foundPhone) : null;

  // 4. Déduplication par maps_url (canonique, comme /api/carte/add-prospect)
  type ExistingProspect = { id: string; name: string; status: string };
  let exists: ExistingProspect | null = null;
  if (supabaseConfigured) {
    const { data } = await supabase
      .from("prospects")
      .select("id, name, status")
      .eq("maps_url", best.c.maps_url)
      .limit(1)
      .maybeSingle();
    if (data) exists = data as ExistingProspect;
  }

  return NextResponse.json({
    found: true,
    candidate: {
      name: best.c.name,
      metier: sector,
      // Le tél Maps fait foi (format SMS-ready) ; sinon on garde celui saisi.
      phone: foundPhone || phone || "",
      ville,
      rating: parseRating(best.c.rating),
      reviews: parseReviews(best.c.reviews),
      website,
      address: address || null,
      maps_url: best.c.maps_url,
      category: best.c.category || "",
    },
    match: {
      nameScore: Math.round(best.score * 100),
      phoneProvided: phone || null,
      phoneFound: foundPhone || null,
      phoneMatch,
    },
    exists,
  });
}
