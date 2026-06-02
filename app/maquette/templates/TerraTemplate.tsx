import type { TemplateProps } from "./data";
import BaseTemplate from "./BaseTemplate";
import type { TemplateTheme } from "./BaseTemplate";

/* ── Terra — warm earth tones, terracotta accent, artisan/craft feel ── */

const theme: TemplateTheme = {
  bg: "#1c1412",
  bgAlt: "#271d1a",
  border: "#3d2e28",
  borderLight: "#5a4840",
  accent: "#c2703e",
  accentBg: "rgba(194,112,62,0.1)",
  accentBorder: "rgba(194,112,62,0.25)",
  text: "#faf5f0",
  muted: "#bfaa98",
  dim: "#8a7564",
  subtle: "#d4c4b5",
  accentFg: "#1c1412",
  heroImage: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1600&q=80",
  heroOverlay: "linear-gradient(to top, #1c1412, rgba(28,20,18,0.6), transparent)",
  heroFade: "linear-gradient(to top, #1c1412, transparent)",
};

export default function TerraTemplate(props: TemplateProps & { nmfCredit?: boolean }) {
  return <BaseTemplate {...props} theme={theme} />;
}
