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

// Nombre de clics/mois estimé pour un artisan local faisant des ads
export const MONTHLY_CLICKS: Record<string, number> = {
  plombier: 150,
  chauffagiste: 130,
  electricien: 120,
  paysagiste: 80,
  couvreur: 100,
  maçon: 90,
  serrurier: 140,
  menuisier: 80,
  carreleur: 70,
  peintre: 80,
};

export const DEFAULT_MONTHLY_CLICKS = 100;

export const SCRAPER_URL = process.env.SCRAPER_URL || "http://51.255.200.169:8001";

export const REPORT_CACHE_DAYS = 7;
