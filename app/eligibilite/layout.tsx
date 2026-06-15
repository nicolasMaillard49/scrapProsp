import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./theme.css";

// Police friendly-premium de la DA funnel (pas Inter — cf. skills front).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export default function EligibiliteLayout({ children }: { children: ReactNode }) {
  return <div className={`${jakarta.variable} fnl min-h-screen`}>{children}</div>;
}
