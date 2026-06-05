import type { TemplateProps } from "./data";
import BaseTemplate from "./BaseTemplate";
import type { TemplateTheme } from "./BaseTemplate";

/* ── Minimal — clean white, emerald accent, Apple-inspired ── */

const theme: TemplateTheme = {
  bg: "#fafafa",
  bgAlt: "#ffffff",
  border: "#e5e5e5",
  borderLight: "#d4d4d4",
  accent: "#059669",
  accentBg: "rgba(5,150,105,0.08)",
  accentBorder: "rgba(5,150,105,0.2)",
  text: "#171717",
  muted: "#525252",
  dim: "#737373",
  subtle: "#404040",
  accentFg: "#fff",
  heroImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80",
  heroOverlay: "linear-gradient(to top, #fafafa, rgba(250,250,250,0.5), transparent)",
  heroFade: "linear-gradient(to top, #fafafa, transparent)",
};

export default function MinimalTemplate(props: TemplateProps & { nmfCredit?: boolean }) {
  return <BaseTemplate {...props} theme={theme} />;
}
