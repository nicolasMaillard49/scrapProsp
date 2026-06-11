// Génère un PDF "Projet" d'exemple avec un vrai prospect + son rapport concurrents.
// Usage : npx tsx scripts/test-pdf.mts   ->  projet-exemple.pdf à la racine.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// .env.local AVANT les imports applicatifs (NEXT_PUBLIC_NMF_PHONE est lu au rendu)
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf-8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const key = t.slice(0, eq).trim();
  if (!(key in process.env)) process.env[key] = t.slice(eq + 1).trim();
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

async function sb(path: string) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// Un prospect "sans site" avec note et avis (cible type de l'offre 299€)
const [prospect] = await sb(
  "prospects?select=id,name,rating,reviews,metier,ville&website=is.null&rating=not.is.null&reviews=gte.3&status=eq.todo&limit=1",
);
if (!prospect) throw new Error("Aucun prospect candidat");
console.log(`Prospect : ${prospect.name} (${prospect.ville}, ${prospect.metier}) — analyse concurrents en cours sur le VPS (~1 min)…`);

// Analyse concurrents en direct via le scraper VPS (la table competitor_reports est vide)
const { computeGbpScore } = await import("../app/lib/gbp");
const { estimateAdsTiers } = await import("../app/lib/competitor-config");
const scrapeRes = await fetch("http://51.255.200.169:8001/scrape", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ metier: prospect.metier, ville: prospect.ville, limit: 8, quick: false }),
  signal: AbortSignal.timeout(240_000),
});
if (!scrapeRes.ok) throw new Error(`scraper: ${scrapeRes.status}`);
const scraped = (await scrapeRes.json()).competitors ?? [];

type Comp = { name: string; gbp_score: number; rating: number | null; reviews: number | null; website?: string | null };
const comps: Comp[] = scraped
  .filter((c: { name?: string }) => c.name)
  .map((c: { name: string; rating?: string; reviews?: string; website?: string; address?: string; phone?: string; maps_url?: string; category?: string }) => {
    const rating = c.rating ? parseFloat(String(c.rating).replace(",", ".")) || null : null;
    const reviews = c.reviews ? parseInt(String(c.reviews), 10) || null : null;
    const website = c.website && String(c.website).startsWith("http") ? c.website : null;
    return {
      name: c.name, rating, reviews, website,
      address: c.address ?? null, phone: c.phone ?? null, maps_url: c.maps_url ?? null, category: c.category ?? null,
      gbp_score: computeGbpScore(rating, reviews, !!website),
    };
  });

const report = {
  id: "test", prospect_id: prospect.id,
  ville: prospect.ville, metier: prospect.metier,
  competitors: comps,
  ads_budget_est: null,
  ads_tiers: estimateAdsTiers(prospect.metier),
  limit_used: 8,
  created_at: new Date().toISOString(),
};
const match = comps.find((c) => c.name.toLowerCase() === prospect.name.toLowerCase());
const prospectScore = match?.gbp_score
  ?? Math.round((prospect.rating != null ? (prospect.rating / 5) * 40 : 0) + Math.min(prospect.reviews ?? 0, 50) / 50 * 30);
const merged: Comp[] = match ? [...comps] : [...comps, { name: prospect.name, gbp_score: prospectScore, rating: prospect.rating, reviews: prospect.reviews }];
merged.sort((a, b) => b.gbp_score - a.gbp_score);
const prospectRank = merged.findIndex((c) => c.name.toLowerCase() === prospect.name.toLowerCase()) + 1;

// QR vers la démo live
const { default: QRCode } = await import("qrcode");
const demoUrlStr = `https://prospects.nmf-agence.com/d/${prospect.id.slice(0, 8)}`;
const qr = await QRCode.toDataURL(demoUrlStr, {
  width: 260, margin: 1, errorCorrectionLevel: "M",
  color: { dark: "#0f0e24", light: "#ffffff" },
});

// Photos du thème métier (plombier : héro, vague, salle de bain)
const { pdfThemeFor } = await import("../app/components/pdf/pdf-theme");
const theme = pdfThemeFor(prospect.metier);
const loadAsset = (p?: string): string | undefined => {
  if (!p) return undefined;
  const f = resolve(ROOT, "public", p.replace(/^\//, ""));
  if (!existsSync(f)) return undefined;
  const mime = p.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${readFileSync(f).toString("base64")}`;
};
const assets = { hero: loadAsset(theme.heroImage), wave: loadAsset(theme.waveImage), side: loadAsset(theme.sideImage) };

const { createElement } = await import("react");
const { renderToFile } = await import("@react-pdf/renderer");
const { ReportPDF } = await import("../app/components/pdf/ReportPDF");

const out = resolve(ROOT, "projet-exemple.pdf");
await renderToFile(
  createElement(ReportPDF, {
    data: {
      report,
      prospectName: prospect.name,
      prospectRating: prospect.rating,
      prospectReviews: prospect.reviews,
      prospectScore,
      prospectRank,
      prospectId: prospect.id,
    },
    demo: { url: demoUrlStr, qr },
    assets,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any,
  out,
);
console.log(`OK — ${prospect.name} (${prospect.ville}, ${report.metier}) · rang #${prospectRank}/${merged.length} · score ${prospectScore} -> ${out}`);
