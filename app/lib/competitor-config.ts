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

// Clics/mois réalistes pour un artisan local en zone rurale/moyenne
export const MONTHLY_CLICKS: Record<string, number> = {
  plombier: 15,
  chauffagiste: 13,
  electricien: 15,
  paysagiste: 13,
  couvreur: 12,
  maçon: 12,
  serrurier: 15,
  menuisier: 10,
  carreleur: 10,
  peintre: 10,
};

export const DEFAULT_MONTHLY_CLICKS = 12;

// Marge sur la gestion Ads (50%)
export const ADS_MARGIN = 1.5;

export const SCRAPER_URL = process.env.SCRAPER_URL || "http://51.255.200.169:8001";

export const REPORT_CACHE_DAYS = 7;
