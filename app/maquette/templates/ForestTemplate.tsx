import type { TemplateProps } from "./data";
import BaseTemplate from "./BaseTemplate";
import type { TemplateTheme } from "./BaseTemplate";

/* ── Forest — deep green tones, warm gold accent, organic/nature feel ── */

const theme: TemplateTheme = {
  bg: "#0c1a0f",
  bgAlt: "#162419",
  border: "#1e3a24",
  borderLight: "#2d5a35",
  accent: "#d4a017",
  accentBg: "rgba(212,160,23,0.1)",
  accentBorder: "rgba(212,160,23,0.25)",
  text: "#ecfdf5",
  muted: "#86efac",
  dim: "#4ade80",
  subtle: "#bbf7d0",
  accentFg: "#0c1a0f",
  heroImage: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1600&q=80",
  heroOverlay: "linear-gradient(to top, #0c1a0f, rgba(12,26,15,0.65), transparent)",
  heroFade: "linear-gradient(to top, #0c1a0f, transparent)",
};

export default function ForestTemplate(props: TemplateProps & { nmfCredit?: boolean }) {
  return <BaseTemplate {...props} theme={theme} />;
}
