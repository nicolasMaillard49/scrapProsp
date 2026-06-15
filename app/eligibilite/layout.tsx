import type { ReactNode } from "react";
import { DM_Sans } from "next/font/google";
import "./theme.css";

// Police de la DA funnel — DM Sans (identique à Lokads, réf. scrappée).
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dmsans",
  display: "swap",
});

export default function EligibiliteLayout({ children }: { children: ReactNode }) {
  return <div className={`${dmSans.variable} fnl min-h-screen`}>{children}</div>;
}
