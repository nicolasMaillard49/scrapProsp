import type { TemplateProps } from "./data";
import BaseTemplate from "./BaseTemplate";
import type { TemplateTheme } from "./BaseTemplate";

/* ── Forest — clair : blanc crème + vert olive très foncé, naturel & élégant ── */

const theme: TemplateTheme = {
  bg: "#faf7ef",        // blanc crème
  bgAlt: "#f1ebdc",     // crème chaud (sections alternées)
  border: "#e4dcc8",    // beige doux
  borderLight: "#d3c8ad",
  accent: "#54672a",    // vert olive foncé (un peu moins sombre)
  accentBg: "rgba(84,103,42,0.08)",
  accentBorder: "rgba(84,103,42,0.22)",
  text: "#2a2e1b",      // encre olive sombre
  muted: "#5e6247",     // olive moyen
  dim: "#84876e",       // olive grisé
  subtle: "#3f4426",    // sous-titres sur crème
  accentFg: "#faf7ef",  // texte crème sur fond olive
  heroImage: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1600&q=80",
  // Hero assombri : image présente + voile vert olive sombre, texte crème.
  heroImageOpacity: 0.9,
  heroOverlay: "linear-gradient(to top, rgba(24,30,15,0.92), rgba(24,30,15,0.55), rgba(24,30,15,0.4))",
  heroFade: "linear-gradient(to top, #faf7ef, transparent)",
  heroText: "#faf7ef",
  heroSubtle: "#e8e3d4",
  heroDim: "#c2bda6",
};

export default function ForestTemplate(props: TemplateProps & { nmfCredit?: boolean }) {
  return <BaseTemplate {...props} theme={theme} />;
}
