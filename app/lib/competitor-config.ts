// CPC moyen par métier en France (2026, source: leo-marchal.fr, sodigix.com)
export const CPC_PAR_METIER: Record<string, number> = {
  plombier: 4.5,
  chauffagiste: 4.0,
  electricien: 3.5,
  paysagiste: 3.0,
  couvreur: 4.0,
  maçon: 3.0,
  serrurier: 5.0,
  menuisier: 3.0,
  carreleur: 2.5,
  peintre: 2.5,
};

export const DEFAULT_CPC = 3.5;

// --- Forfaits Google Ads ---
// Chaque forfait : { label, clicks/mois, inclut gestion + ad spend }
export interface AdsTier {
  key: string;
  label: string;
  desc: string;
  clicksPerMonth: number;
}

export const ADS_TIERS: AdsTier[] = [
  {
    key: "eco",
    label: "Éco",
    desc: "Visibilité locale de base",
    clicksPerMonth: 40,
  },
  {
    key: "performance",
    label: "Performance",
    desc: "Couverture solide, leads réguliers",
    clicksPerMonth: 100,
  },
  {
    key: "top1",
    label: "Go Top 1",
    desc: "Dominer le marché local",
    clicksPerMonth: 200,
  },
];

// Marge globale (ad spend + gestion) : x2.2 du coût brut
// Ex: plombier éco = 4.5€ × 40 clics = 180€ brut → 180 × 2.2 = 396€ → arrondi 400€
export const ADS_MARGIN = 2.2;

export function estimateAdsTiers(metier: string): { key: string; label: string; desc: string; budget: number }[] {
  const cpc = CPC_PAR_METIER[metier] ?? DEFAULT_CPC;
  return ADS_TIERS.map((tier) => ({
    key: tier.key,
    label: tier.label,
    desc: tier.desc,
    budget: Math.round((cpc * tier.clicksPerMonth * ADS_MARGIN) / 50) * 50, // arrondi aux 50€
  }));
}

export const SCRAPER_URL = process.env.SCRAPER_URL || "http://51.255.200.169:8001";

export const REPORT_CACHE_DAYS = 7;
