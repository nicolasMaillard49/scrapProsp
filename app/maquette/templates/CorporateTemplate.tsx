import type { TemplateProps } from "./data";
import BaseTemplate from "./BaseTemplate";
import type { TemplateTheme } from "./BaseTemplate";

/* ── Corporate design — dark brutalist, amber accent ── */

const theme: TemplateTheme = {
  bg: "#0a0a0a",
  bgAlt: "#171717",
  border: "#262626",
  borderLight: "#404040",
  accent: "#f59e0b",
  accentBg: "rgba(245,158,11,0.1)",
  accentBorder: "rgba(245,158,11,0.2)",
  text: "#fafafa",
  muted: "#a3a3a3",
  dim: "#737373",
  subtle: "#d4d4d4",
  accentFg: "#0a0a0a",
  heroImage: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1600&q=80",
  heroOverlay: "linear-gradient(to top, #0a0a0a, rgba(10,10,10,0.6), transparent)",
  heroFade: "linear-gradient(to top, #0a0a0a, transparent)",
};

export default function CorporateTemplate(props: TemplateProps & { nmfCredit?: boolean }) {
  return <BaseTemplate {...props} theme={theme} />;
}
