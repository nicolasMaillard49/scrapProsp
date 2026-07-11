// Rapport concurrentiel d'un prospect (partagé par le script CLI et l'API cockpit).
//
// À partir d'un métier + une ville, interroge le scraper Maps et calcule :
//   - le classement du prospect sur « métier ville » (rang, ou null = absent) ;
//   - la liste des concurrents (nom, note, avis, rang) ;
//   - qui fait des Google Ads : sponsorisé Maps ("/aclk…") en direct, ou tag de
//     conversion/remarketing détecté sur leur site.
import { SCRAPER_URL as DEFAULT_SCRAPER_URL } from "./competitor-config";

export type AdsSignal = "sponso" | "tag" | "non";

export interface CompetitorLine {
  rank: number;
  name: string;
  rating: number | null;
  reviews: number | null;
  website: string | null;
  ads: AdsSignal;
  isSelf: boolean;
}

export interface IgCompetitorReport {
  metier: string;
  ville: string;
  total: number;
  selfRank: number | null;
  selfMatch: string | null;
  adsCount: number;
  sponsoredCount: number;
  competitors: CompetitorLine[];
}

interface ScraperComp {
  name: string;
  rating?: string;
  reviews?: string;
  website?: string;
  phone?: string;
  address?: string;
  maps_url?: string;
}

const isSponsored = (c: ScraperComp) => (c.website ?? "").trim().startsWith("/aclk");
const cleanSite = (c: ScraperComp) => {
  const w = (c.website ?? "").trim();
  return w.startsWith("http") ? w : null;
};

/** Tag de conversion/remarketing Google Ads dans le HTML du site (= il fait des Ads). */
async function hasGoogleAdsTag(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!r.ok) return false;
    const html = await r.text();
    return /AW-\d{6,}/.test(html) || /googleads\.g\.doubleclick\.net|googleadservices\.com/.test(html);
  } catch {
    return false;
  }
}

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const rawTokens = (s: string) => norm(s).split(" ").filter(Boolean);

// Mots génériques ignorés pour le rapprochement de noms (le nom de LA ville et
// DU métier cherchés sont ajoutés dynamiquement — sinon un concurrent matche sur
// « biarritz » ou « paysagiste », qui sont dans la requête).
const GENERIC_STOP = [
  "paysagiste", "paysagisme", "elagage", "jardin", "jardins", "espace", "vert", "verts",
  "sarl", "eurl", "entreprise", "sas", "fils", "and", "et", "de", "la", "le", "les", "du", "des",
];

export interface ReportInput {
  metier: string;
  ville: string;
  fullName?: string | null;
  username?: string | null;
}

/**
 * Construit le rapport concurrentiel. Lance le scrape Maps puis les checks de tag
 * Ads en parallèle. `metier` et `ville` sont requis (sinon rien à interroger).
 */
export async function buildCompetitorReport(
  input: ReportInput,
  opts: { scraperUrl?: string; limit?: number; full?: boolean } = {},
): Promise<IgCompetitorReport> {
  const metier = (input.metier || "").trim();
  const ville = (input.ville || "").trim();
  if (!metier || !ville) throw new Error("métier et ville requis pour le rapport concurrentiel");

  const scraperUrl = opts.scraperUrl || DEFAULT_SCRAPER_URL;
  const limit = opts.limit ?? 20;
  const quick = !opts.full;

  const res = await fetch(`${scraperUrl}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metier, ville, limit, quick }),
    signal: AbortSignal.timeout(quick ? 120_000 : 240_000),
  });
  if (!res.ok) throw new Error(`scraper HTTP ${res.status}`);
  const competitors: ScraperComp[] = (await res.json()).competitors ?? [];

  // Signal Ads par concurrent (checks site en parallèle).
  const signals = await Promise.all(
    competitors.map(async (c): Promise<AdsSignal> => {
      if (isSponsored(c)) return "sponso";
      const site = cleanSite(c);
      return site && (await hasGoogleAdsTag(site)) ? "tag" : "non";
    }),
  );

  // Rang du prospect : match par tokens de nom distinctifs (hors ville/métier).
  const STOP = new Set([...GENERIC_STOP, ...rawTokens(ville), ...rawTokens(metier)]);
  const tokens = (s: string) => rawTokens(s).filter((t) => t.length >= 4 && !STOP.has(t));
  const pTokens = new Set([...tokens(input.fullName || ""), ...tokens(input.username || "")]);
  let selfRank: number | null = null;
  let selfMatch: string | null = null;
  competitors.forEach((c, i) => {
    if (selfRank !== null || pTokens.size === 0) return;
    if (tokens(c.name).some((t) => pTokens.has(t))) {
      selfRank = i + 1;
      selfMatch = c.name;
    }
  });

  const lines: CompetitorLine[] = competitors.map((c, i) => ({
    rank: i + 1,
    name: c.name,
    rating: c.rating ? Number(String(c.rating).replace(",", ".")) || null : null,
    reviews: c.reviews ? parseInt(c.reviews, 10) || null : null,
    website: isSponsored(c) ? null : cleanSite(c),
    ads: signals[i],
    isSelf: selfRank === i + 1,
  }));

  return {
    metier,
    ville,
    total: competitors.length,
    selfRank,
    selfMatch,
    adsCount: signals.filter((s) => s !== "non").length,
    sponsoredCount: signals.filter((s) => s === "sponso").length,
    competitors: lines,
  };
}
