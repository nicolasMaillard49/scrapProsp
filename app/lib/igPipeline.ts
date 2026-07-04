// Pipeline de prospection Instagram — logique PURE (quotas, chauffe, relances).
// Encode les règles de la méthode (source : assistance Meta via Notion Generate.io) :
//  - max 15 messages/heure, 60/jour, montée progressive pour un compte neuf ;
//  - relances jamais entre 20 h et 8 h ;
//  - vu sans réponse → R1 +1 h, puis R2 +6-8 h, R3 +5-8 h ; pas de vu → +48 h.

export type AccountStatus = "warmup" | "chaud" | "pause";

export interface Caps {
  hourly: number;
  daily: number;
  /** Jour du plan de chauffe (1-indexé) ; 0 si compte chaud/pause. */
  day: number;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Plafonds du jour selon le plan de chauffe (démarré à `started_at`).
 * J1-2 : 5/h·15/j → J3-4 : 10/20 → J5-7 : 10/25 → J8-10 : 15/30 →
 * J11-14 : 15/40 → J15+ (ou statut chaud) : 15/h·60/j. Pause : 0/0.
 */
export function warmupCaps(startedAt: string | Date, status: AccountStatus, now = Date.now()): Caps {
  if (status === "pause") return { hourly: 0, daily: 0, day: 0 };
  const start = typeof startedAt === "string" ? Date.parse(startedAt) : startedAt.getTime();
  const day = Math.max(1, Math.floor((now - start) / DAY_MS) + 1);
  if (status === "chaud" || day >= 15) return { hourly: 15, daily: 60, day: status === "chaud" ? 0 : day };
  if (day <= 2) return { hourly: 5, daily: 15, day };
  if (day <= 4) return { hourly: 10, daily: 20, day };
  if (day <= 7) return { hourly: 10, daily: 25, day };
  if (day <= 10) return { hourly: 15, daily: 30, day };
  return { hourly: 15, daily: 40, day }; // J11-14
}

/** Reporte une date hors fenêtre d'envoi (8 h-20 h, heure locale) au créneau valide suivant. */
export function clampToWindow(date: Date): Date {
  const d = new Date(date);
  const h = d.getHours();
  if (h >= 20) {
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
  } else if (h < 8) {
    d.setHours(8, 0, 0, 0);
  }
  return d;
}

/**
 * Prochaine relance à programmer.
 * `seen=true` (vu sans réponse) : R1 +1 h, R2 +7 h, R3 +6 h, ensuite +24 h.
 * `seen=false` (pas de vu) : +48 h. Toujours clampé à la fenêtre 8 h-20 h.
 */
export function nextFollowup(now: Date, followupCount: number, seen: boolean): Date {
  let delayH: number;
  if (!seen) delayH = 48;
  else if (followupCount <= 0) delayH = 1;
  else if (followupCount === 1) delayH = 7;
  else if (followupCount === 2) delayH = 6;
  else delayH = 24;
  return clampToWindow(new Date(now.getTime() + delayH * 3600 * 1000));
}

/** Stades du pipeline (ordre d'avancement). */
export const STAGES = [
  "accroche",
  "presentation",
  "connexion",
  "douleur",
  "appel_propose",
  "questionnaire_envoye",
  "call_booke",
  "perdu",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  accroche: "Accroche envoyée",
  presentation: "Présentation",
  connexion: "Connexion",
  douleur: "Douleur",
  appel_propose: "Appel proposé",
  questionnaire_envoye: "Questionnaire envoyé",
  call_booke: "Call booké ✓",
  perdu: "Perdu",
};

/** Stade atteint quand on marque une étape de la séquence comme envoyée. */
export function stageForStep(step: string): Stage | null {
  switch (step) {
    case "M1":
      return "accroche";
    case "M2":
    case "M3":
    case "M4":
      return "presentation";
    case "M5":
    case "M6":
      return "connexion";
    case "M7":
      return "douleur";
    case "M8":
      return "appel_propose";
    case "M9":
      return "questionnaire_envoye";
    default:
      return null; // R1-R3 : le stade ne bouge pas
  }
}

export const VALID_STEPS = new Set(["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "R1", "R2", "R3"]);
