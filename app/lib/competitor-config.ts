export const CPC_PAR_METIER: Record<string, number> = {
  plombier: 3.0,
  electricien: 2.5,
  paysagiste: 2.0,
};

export const DEFAULT_CPC = 2.5;
export const CTR = 0.035;

// Monthly search volume coefficient per 10k inhabitants
export const VOLUME_COEFF: Record<string, number> = {
  plombier: 120,
  electricien: 90,
  paysagiste: 60,
};

export const DEFAULT_VOLUME_COEFF = 80;

export const SCRAPER_URL = process.env.SCRAPER_URL || "http://51.255.200.169:8001";

export const REPORT_CACHE_DAYS = 7;
