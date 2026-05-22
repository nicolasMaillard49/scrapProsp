import type { Prospect } from "./types";

export function isRadie(p: Prospect): boolean {
  return p.legal_status === "radie";
}

export function ageYears(p: Prospect): number | null {
  if (!p.age_years) return null;
  const n = Number(p.age_years);
  return Number.isFinite(n) ? n : null;
}

export function isJeune(p: Prospect, threshold = 5): boolean {
  const a = ageYears(p);
  return a !== null && a < threshold;
}

export type AgeBadge = { label: string; cls: string; emoji: string };

export function ageBadge(p: Prospect): AgeBadge | null {
  if (isRadie(p)) {
    return {
      emoji: "⛔",
      label: "Radié",
      cls: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    };
  }
  const a = ageYears(p);
  if (a === null) return null;
  const word = a <= 1 ? `${a} an` : `${a} ans`;
  if (a < 3) {
    return {
      emoji: "🌱",
      label: word,
      cls: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    };
  }
  if (a < 7) {
    return {
      emoji: "",
      label: word,
      cls: "bg-amber-500/10 text-amber-200 border border-amber-500/20",
    };
  }
  if (a < 15) {
    return {
      emoji: "",
      label: word,
      cls: "bg-neutral-700/40 text-neutral-300 border border-neutral-600/40",
    };
  }
  return {
    emoji: "",
    label: word,
    cls: "bg-neutral-800/60 text-neutral-500 border border-neutral-700/50",
  };
}
