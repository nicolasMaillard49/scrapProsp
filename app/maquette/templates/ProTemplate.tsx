import type { TemplateProps } from "./data";
import BaseTemplate from "./BaseTemplate";
import type { TemplateTheme } from "./BaseTemplate";

/* ── Pro design — navy/slate brutalist, orange accent ── */

const theme: TemplateTheme = {
  bg: "#0f172a",
  bgAlt: "#1e293b",
  border: "#334155",
  borderLight: "#475569",
  accent: "#f97316",
  accentBg: "rgba(249,115,22,0.1)",
  accentBorder: "rgba(249,115,22,0.2)",
  text: "#f8fafc",
  muted: "#94a3b8",
  dim: "#64748b",
  subtle: "#cbd5e1",
  accentFg: "#fff",
  heroImage: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1600&q=80",
  heroOverlay: "linear-gradient(to top, #0f172a, rgba(15,23,42,0.6), transparent)",
  heroFade: "linear-gradient(to top, #0f172a, transparent)",
};

export default function ProTemplate(props: TemplateProps & { nmfCredit?: boolean }) {
  return <BaseTemplate {...props} theme={theme} />;
}
