import type { TemplateProps } from "./data";
import BaseTemplate from "./BaseTemplate";
import type { TemplateTheme } from "./BaseTemplate";

/* ── Electric — dark with cyan/electric blue accent, modern tech feel ── */

const theme: TemplateTheme = {
  bg: "#030712",
  bgAlt: "#111827",
  border: "#1f2937",
  borderLight: "#374151",
  accent: "#06b6d4",
  accentBg: "rgba(6,182,212,0.1)",
  accentBorder: "rgba(6,182,212,0.25)",
  text: "#f9fafb",
  muted: "#9ca3af",
  dim: "#6b7280",
  subtle: "#d1d5db",
  accentFg: "#030712",
  heroImage: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1600&q=80",
  heroOverlay: "linear-gradient(to top, #030712, rgba(3,7,18,0.7), transparent)",
  heroFade: "linear-gradient(to top, #030712, transparent)",
};

export default function ElectricTemplate(props: TemplateProps) {
  return <BaseTemplate {...props} theme={theme} />;
}
