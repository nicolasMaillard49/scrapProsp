// Pipeline de prospection Instagram — logique PURE (quotas, chauffe, relances).
// Encode les règles de la méthode (source : assistance Meta via Notion Generate.io) :
//  - chauffe : J1 5/j, J2 10/j, J3 15/j, puis +5/jour — jamais > 60/j (limite PAR JOUR, pas par heure) ;
//  - relances jamais entre 20 h et 8 h ;
//  - vu sans réponse → R1 +1 h, puis R2 +6-8 h, R3 +5-8 h ; pas de vu → +48 h.

export type AccountStatus = "warmup" | "chaud" | "pause";

export interface Caps {
  daily: number;
  /** Jour du plan de chauffe (1-indexé) ; 0 si compte chaud/pause. */
  day: number;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Plafond du jour selon le plan de chauffe (démarré à `started_at`).
 * J1 : 5/j → J2 : 10/j → J3 : 15/j, puis +5/jour jusqu'au plafond Meta
 * (60/j, atteint à J12). Statut chaud : plafond max direct. Pause : 0.
 */
export function warmupCaps(startedAt: string | Date, status: AccountStatus, now = Date.now()): Caps {
  if (status === "pause") return { daily: 0, day: 0 };
  if (status === "chaud") return { daily: 60, day: 0 };
  const start = typeof startedAt === "string" ? Date.parse(startedAt) : startedAt.getTime();
  const day = Math.max(1, Math.floor((now - start) / DAY_MS) + 1);
  const daily = Math.min(60, day <= 3 ? day * 5 : 15 + (day - 3) * 5);
  return { daily, day };
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

/** Nombre de relances programmées après un M1. Au-delà, plus rien n'est mis en file. */
export const MAX_FOLLOWUPS = 1;

/**
 * Prochaine relance à programmer, ou `null` s'il n'y en a plus.
 * R1 seule : +1 h après un vu, +48 h sans vu. Clampé à la fenêtre 8 h-20 h.
 * Le plafond jour d'un compte est partagé entre relances et M1 : chaque relance
 * programmée est un M1 en moins. Mesuré le 16/07/2026 sur 47 prospects relancés,
 * aucun n'a répondu au-delà de R1 — R2/R3 consommaient le quota pour rien.
 */
export function nextFollowup(now: Date, followupCount: number, seen: boolean): Date | null {
  if (followupCount >= MAX_FOLLOWUPS) return null;
  return clampToWindow(new Date(now.getTime() + (seen ? 1 : 48) * 3600 * 1000));
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
