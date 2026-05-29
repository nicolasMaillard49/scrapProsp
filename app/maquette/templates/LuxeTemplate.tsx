import type { TemplateProps } from "./data";
import BaseTemplate from "./BaseTemplate";
import type { TemplateTheme } from "./BaseTemplate";

/* ── Luxe — pure black, gold accent, premium/luxury feel ── */

const theme: TemplateTheme = {
  bg: "#000000",
  bgAlt: "#0a0a0a",
  border: "#1a1a1a",
  borderLight: "#2a2a2a",
  accent: "#c8a45e",
  accentBg: "rgba(200,164,94,0.08)",
  accentBorder: "rgba(200,164,94,0.2)",
  text: "#f5f5f0",
  muted: "#a8a8a0",
  dim: "#6b6b64",
  subtle: "#d4d4cc",
  accentFg: "#000000",
  heroImage: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&q=80",
  heroOverlay: "linear-gradient(to top, #000000, rgba(0,0,0,0.55), transparent)",
  heroFade: "linear-gradient(to top, #000000, transparent)",
};

export default function LuxeTemplate(props: TemplateProps) {
  return <BaseTemplate {...props} theme={theme} />;
}
