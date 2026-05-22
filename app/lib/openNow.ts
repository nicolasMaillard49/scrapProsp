import type { Prospect } from "./types";

const DAY_TOKENS: Record<string, number> = {
  dim: 0, lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6,
};

function defaultArtisanOpen(now: Date): boolean {
  const day = now.getDay();
  const hm = now.getHours() + now.getMinutes() / 60;
  if (day === 0) return false;
  if (day === 6) return hm >= 8 && hm < 13;
  return hm >= 7 && hm < 20;
}

function parseOpensAt(s: string): { h: number; m: number; day: number | null } | null {
  const m = s.match(/ouvre\s+à\s+(\d{1,2})\s*[:hH]\s*(\d{2})(?:\s+(dim|lun|mar|mer|jeu|ven|sam)\.?)?/i);
  if (!m) return null;
  return {
    h: parseInt(m[1], 10),
    m: parseInt(m[2], 10),
    day: m[3] ? DAY_TOKENS[m[3].toLowerCase()] : null,
  };
}

function parseClosesAt(s: string): { h: number; m: number } | null {
  const m = s.match(/ferme\s+à\s+(\d{1,2})\s*[:hH]\s*(\d{2})/i);
  if (!m) return null;
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
}

export function isOpenNow(
  p: Pick<Prospect, "hours_status">,
  now: Date,
  _scrapeDate: Date,
): boolean {
  const s = (p.hours_status || "").trim().toLowerCase();
  if (!s) return defaultArtisanOpen(now);

  if (/ouvert\s*24\s*h/.test(s)) return true;
  if (/ferm[ée]\s+(temporairement|d[ée]finitivement|d[ée]f)/.test(s)) return false;

  const closes = parseClosesAt(s);
  if (closes) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const closeMin = closes.h * 60 + closes.m;
    return nowMin < closeMin && defaultArtisanOpen(now);
  }

  const opens = parseOpensAt(s);
  if (!opens) return defaultArtisanOpen(now);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = opens.h * 60 + opens.m;
  const today = now.getDay();

  if (opens.day === null || opens.day === today) {
    return nowMin >= openMin && defaultArtisanOpen(now);
  }

  return false;
}

export function openLabel(
  p: Pick<Prospect, "hours_status">,
  now: Date,
  scrapeDate: Date,
): string {
  const raw = (p.hours_status || "").trim();
  const open = isOpenNow(p, now, scrapeDate);

  if (!raw && open) return "Ouvert";
  if (!raw && !open) return "Fermé";

  if (/ouvert\s*24\s*h/i.test(raw)) return "Ouvert 24h/24";

  const closes = parseClosesAt(raw);
  if (closes && open) return `Ouvert · ferme à ${String(closes.h).padStart(2, "0")}:${String(closes.m).padStart(2, "0")}`;
  if (closes && !open) return raw;

  const opens = parseOpensAt(raw);
  if (opens && open) {
    return `Ouvert · depuis ${String(opens.h).padStart(2, "0")}:${String(opens.m).padStart(2, "0")}`;
  }
  if (opens && !open) return raw;

  return open ? "Ouvert" : raw || "Fermé";
}

export function parseScrapeDate(raw?: string): Date {
  if (!raw) return new Date();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return new Date(raw) || new Date();
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}
