// Prévisualisation hors-ligne du PDF avec des données fictives.
// Usage : npx tsx scripts/preview-pdf.mts [metier]   ->  projet-preview.pdf à la racine.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const METIER = process.argv[2] ?? "plombier";

const mk = (name: string, rating: number, reviews: number, website: string | null, gbp_score: number) => ({
  name, rating, reviews, website,
  address: null, phone: null, maps_url: null, category: null,
  gbp_score,
});

const report = {
  id: "preview", prospect_id: "preview",
  ville: "Millières", metier: METIER,
  competitors: [
    mk("Plomberie Martin", 4.7, 34, "https://plomberie-martin.fr", 78),
    mk("SOS Plomberie 24/7", 4.4, 12, "https://sos-plomberie.fr", 67),
    mk("Plombier Service Express", 4.3, 7, "https://pse.fr", 55),
    mk("Dupont Plomberie", 4.5, 9, null, 48),
    mk("Artisan Plombier Local", 4.0, 3, "https://apl.fr", 22),
  ],
  ads_budget_est: null,
  ads_tiers: null,
  limit_used: 8,
  created_at: new Date().toISOString(),
};

const { default: QRCode } = await import("qrcode");
const demoUrlStr = "https://prospects.nmf-agence.com/d/f6891718";
const qr = await QRCode.toDataURL(demoUrlStr, {
  width: 260, margin: 1, errorCorrectionLevel: "M",
  color: { dark: "#0f0e24", light: "#ffffff" },
});

const { pdfThemeFor } = await import("../app/components/pdf/pdf-theme");
const theme = pdfThemeFor(report.metier);
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

const out = resolve(ROOT, "projet-preview.pdf");
await renderToFile(
  createElement(ReportPDF, {
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      report: report as any,
      prospectName: "Dupont Plomberie",
      prospectRating: 4.5,
      prospectReviews: 9,
      prospectScore: 48,
      prospectRank: 4,
      prospectId: "f6891718-0000-0000-0000-000000000000",
    },
    demo: { url: demoUrlStr, qr },
    assets,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any,
  out,
);
console.log(`OK -> ${out}`);
