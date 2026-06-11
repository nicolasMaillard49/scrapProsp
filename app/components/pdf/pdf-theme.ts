/**
 * Identité visuelle du PDF par métier.
 * Le plombier a son univers « eau » (bleu marine + photos) ; les autres
 * métiers gardent l'identité violette NMF sur le même layout.
 */
export interface PdfTheme {
  /** Fond sombre — page 1 entière + carte démo. */
  ink: string;
  inkSoft: string;
  /** Cartes posées sur le fond sombre. */
  card: string;
  cardBorder: string;
  /** Accent principal (ligne VOUS, badges, kickers page claire). */
  accent: string;
  /** Variante foncée de l'accent (dégradés, bandeau CTA). */
  accentDark: string;
  /** Texte clair sur fond sombre. */
  accentSoft: string;
  /** Kickers / labels sur fond sombre. */
  accentMuted: string;
  /** Texte discret sur fond sombre (méta, footer). */
  mutedOnDark: string;
  /** Fond teinté clair (page 2). */
  accentBg: string;
  /** Ligne VOUS du tableau — par défaut `accent` (foncé requis si l'accent est clair). */
  youRow?: string;
  /** Photos optionnelles (chemins public/, résolus en data URL par l'appelant). */
  heroImage?: string;
  waveImage?: string;
  sideImage?: string;
  /** Icône signature à côté du titre + dans le bandeau final. */
  icon?: "drop" | "leaf" | "zap";
}

/** Data URLs des photos du thème, résolues côté appelant (fetch ou fs). */
export interface PdfAssets {
  hero?: string;
  wave?: string;
  side?: string;
}

const PLOMBIER: PdfTheme = {
  ink: "#021026",
  inkSoft: "#07193a",
  card: "#0a1f3d",
  cardBorder: "#1d3a5f",
  accent: "#2563eb",
  accentDark: "#1e3f8f",
  accentSoft: "#bfdbfe",
  accentMuted: "#7da7e8",
  mutedOnDark: "#54719e",
  accentBg: "#eff6ff",
  heroImage: "/pdf/plombier-hero.jpg",
  waveImage: "/pdf/plombier-wave.jpg",
  sideImage: "/pdf/plombier-bain.png",
  icon: "drop",
};

const PAYSAGISTE: PdfTheme = {
  ink: "#06140c",
  inkSoft: "#0b2014",
  card: "#0c2316",
  cardBorder: "#1d4430",
  accent: "#16a34a",
  accentDark: "#166534",
  accentSoft: "#bbf7d0",
  accentMuted: "#67c08e",
  mutedOnDark: "#4a7a5e",
  accentBg: "#f0fdf4",
  heroImage: "/pdf/paysagiste-hero.jpg",
  waveImage: "/pdf/paysagiste-herbe.jpg",
  sideImage: "/pdf/paysagiste-jardin.png",
  icon: "leaf",
};

const ELECTRICIEN: PdfTheme = {
  ink: "#0c0c12",
  inkSoft: "#191925",
  card: "#181822",
  cardBorder: "#2f2f42",
  accent: "#f59e0b",
  accentDark: "#b45309",
  accentSoft: "#fde68a",
  accentMuted: "#d9a441",
  mutedOnDark: "#7d7460",
  accentBg: "#fffbeb",
  youRow: "#b45309",
  heroImage: "/pdf/electricien-hero.jpg",
  waveImage: "/pdf/electricien-lumiere.jpg",
  sideImage: "/pdf/electricien-interieur.png",
  icon: "zap",
};

const DEFAULT: PdfTheme = {
  ink: "#0c0b1d",
  inkSoft: "#171532",
  card: "#191734",
  cardBorder: "#2e2b55",
  accent: "#7c3aed",
  accentDark: "#5b21b6",
  accentSoft: "#c9c5ec",
  accentMuted: "#a78bfa",
  mutedOnDark: "#7d7aa8",
  accentBg: "#f5f3ff",
};

export function pdfThemeFor(metier: string | null | undefined): PdfTheme {
  const m = (metier ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (m.includes("plomb")) return PLOMBIER;
  if (m.includes("paysag") || m.includes("jardin")) return PAYSAGISTE;
  if (m.includes("electric")) return ELECTRICIEN;
  return DEFAULT;
}
