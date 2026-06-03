import type { TemplateProps } from "./data";
import BaseTemplate from "./BaseTemplate";
import type { TemplateTheme } from "./BaseTemplate";

/* ── Forest — clair : blanc crème + vert olive très foncé, naturel & élégant ── */

const theme: TemplateTheme = {
  bg: "#faf7ef",        // blanc crème
  bgAlt: "#f1ebdc",     // crème chaud (sections alternées)
  border: "#e4dcc8",    // beige doux
  borderLight: "#d3c8ad",
  accent: "#3c4a1e",    // vert olive très foncé
  accentBg: "rgba(60,74,30,0.08)",
  accentBorder: "rgba(60,74,30,0.22)",
  text: "#2a2e1b",      // encre olive sombre
  muted: "#5e6247",     // olive moyen
  dim: "#84876e",       // olive grisé
  subtle: "#3f4426",    // sous-titres sur crème
  accentFg: "#faf7ef",  // texte crème sur fond olive
  heroImage: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1600&q=80",
  heroOverlay: "linear-gradient(to top, #faf7ef, rgba(250,247,239,0.6), rgba(250,247,239,0.2))",
  heroFade: "linear-gradient(to top, #faf7ef, transparent)",
};

export default function ForestTemplate(props: TemplateProps & { nmfCredit?: boolean }) {
  return <BaseTemplate {...props} theme={theme} />;
}
