// Pipeline de prospection Instagram — logique PURE (quotas, chauffe, relances).
// Encode les règles de la méthode (source : assistance Meta via Notion Generate.io) :
//  - chauffe : J1 5/j, J2 10/j, J3 15/j, puis +5/jour — jamais > 50/j (limite PAR JOUR, pas par heure) ;
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
 * Plafond ABSOLU de DM par jour et par compte. Décision Nicolas (22/07/2026) :
 * on ne dépasse plus JAMAIS 50/jour, quel que soit le statut du compte.
 * Descendu de 60 (ancien plafond Meta théorique) pour préserver les comptes.
 */
export const MAX_DAILY = 50;

/**
 * Plafond du jour selon le plan de chauffe (démarré à `started_at`).
 * J1 : 5/j → J2 : 10/j → J3 : 15/j, puis +5/jour jusqu'à `MAX_DAILY`
 * (50/j, atteint à J10). Statut chaud : plafond max direct. Pause : 0.
 */
export function warmupCaps(startedAt: string | Date, status: AccountStatus, now = Date.now()): Caps {
  if (status === "pause") return { daily: 0, day: 0 };
  if (status === "chaud") return { daily: MAX_DAILY, day: 0 };
  const start = typeof startedAt === "string" ? Date.parse(startedAt) : startedAt.getTime();
  const day = Math.max(1, Math.floor((now - start) / DAY_MS) + 1);
  const daily = Math.min(MAX_DAILY, day <= 3 ? day * 5 : 15 + (day - 3) * 5);
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
  "receptif",
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
  receptif: "Réceptif",
  presentation: "Présentation",
  connexion: "Connexion",
  douleur: "Douleur",
  appel_propose: "Appel proposé",
  questionnaire_envoye: "Questionnaire envoyé",
  call_booke: "Call booké ✓",
  perdu: "Perdu",
};

/** Libellés COURTS pour les en-têtes de colonnes du pipeline (kanban). */
export const STAGE_SHORT: Record<Stage, string> = {
  accroche: "Accroche",
  receptif: "Réceptif",
  presentation: "Présentation",
  connexion: "Connexion",
  douleur: "Point de douleur",
  appel_propose: "Appel proposé",
  questionnaire_envoye: "Questionnaire",
  call_booke: "Call booké",
  perdu: "Perdu",
};

/**
 * Teinte SÉMANTIQUE d'un stade (l'UI mappe ces clés vers des classes Tailwind).
 * Le stade — pas le `status` historique — est la source de vérité du suivi ;
 * cette fonction fournit l'axe froid → chaud → gagné/perdu utilisé partout.
 */
export type StageTone = "todo" | "cold" | "progress" | "warm" | "won" | "lost";
export function stageTone(stage: string | null): StageTone {
  switch (stage) {
    case null:
    case "":
      return "todo";
    case "accroche":
      return "cold";
    // Il a répondu : la conversation est vivante mais rien n'a encore été
    // travaillé. C'est le seul stade que l'on pose sans avoir rien envoyé.
    case "receptif":
    case "presentation":
    case "connexion":
      return "progress";
    case "douleur":
    case "appel_propose":
    case "questionnaire_envoye":
      return "warm";
    case "call_booke":
      return "won";
    case "perdu":
      return "lost";
    default:
      return "progress";
  }
}

/**
 * État MACRO dérivé du pipeline pour l'affichage — remplace la lecture directe du
 * `status` (4 valeurs) qui se désynchronise du `stage`. Le stade + les réponses
 * reçues priment ; le `status` ne sert que de repli.
 */
export type LeadState = "a_contacter" | "en_attente" | "en_conversation" | "gagne" | "perdu";
export function leadState(stage: string | null, replyCount: number, status: string): LeadState {
  if (stage === "call_booke" || status === "positive") return "gagne";
  if (stage === "perdu" || status === "negative") return "perdu";
  if ((replyCount ?? 0) > 0) return "en_conversation";
  if (status === "todo" || !stage) return "a_contacter";
  return "en_attente";
}

/**
 * Les deux trames DM.
 *  - `standard` : M1…M9, la méthode complète (présentation, connexion, douleur).
 *  - `site`     : S1, S3, S4, S5 — la variante « il n'a pas de site » : sa
 *                 maquette dès le message qui suit son oui (cf.
 *                 `instagramDmSequenceSite`). S2 (la question « on vous
 *                 trouve où ? ») a été retiré le 03/09/2026 ; le code reste
 *                 connu pour l'historique du journal.
 * Les relances R1-R3 sont communes : elles relancent le silence, pas l'étape.
 */
export const TRAMES = ["standard", "site"] as const;
export type Trame = (typeof TRAMES)[number];

/** Trame à laquelle appartient une étape (les relances n'appartiennent à aucune). */
export function trameOfStep(step: string): Trame | null {
  if (/^M\d$/.test(step)) return "standard";
  if (/^S\d$/.test(step)) return "site";
  return null;
}

/**
 * Premier message d'une trame, quelle qu'elle soit.
 *
 * Tout ce qui compte les ACCROCHES (KPI de réponse à froid, sortie de la
 * sélection du jour) doit passer par ici : tester `step === "M1"` en dur
 * rendrait la trame site invisible dans les compteurs le jour de sa mise en
 * service — et invisible, elle serait réputée sans effet.
 */
export function isAccrocheStep(step: string): boolean {
  return step === "M1" || step === "S1";
}

/** Toutes les premières étapes — pour les filtres SQL (`.in("step", …)`). */
export const ACCROCHE_STEPS = ["M1", "S1"];

/**
 * Cette étape PÈSE-T-ELLE sur le plafond du jour ?
 *
 * Non pour les suites de conversation (M2-M9 / S2-S5). Répondre à quelqu'un qui
 * vient d'écrire n'est pas un envoi à froid : ce n'est ni le risque que la
 * chauffe cherche à contenir (Meta juge le contact NON SOLLICITÉ), ni un
 * prospect de plus. Les compter revenait à faire payer les conversations
 * vivantes — une journée où l'on répond beaucoup laissait moins de place aux
 * accroches, exactement l'inverse de ce qu'on veut. C'est le pendant, côté
 * quota, de l'invariant 2 de `igDmLog` : un envoi compté, c'est une accroche.
 *
 * Oui pour la relance : elle s'adresse à un silence, donc à quelqu'un qui n'a
 * rien demandé — même risque qu'un premier contact, même quota (cf.
 * `nextFollowup` : « chaque relance programmée est un M1 en moins »).
 */
export function countsAgainstQuota(step: string): boolean {
  return isAccrocheStep(step) || step.startsWith("R");
}

/** Les étapes qui consomment le quota — pour les filtres SQL (`.in("step", …)`). */
export const QUOTA_STEPS = [...ACCROCHE_STEPS, "R1", "R2", "R3"];

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

    // ── Trame site ──────────────────────────────────────────────────────────
    // Le stade est une POSITION dans le tunnel, pas un résumé du message : la
    // trame site occupe les mêmes positions que la standard, en sautant
    // `connexion` (elle ne fait pas de tour de chauffe). C'est ce qui garde le
    // kanban monotone et les deux trames comparables colonne par colonne.
    case "S1":
      return "accroche";
    case "S2": // historique uniquement (retiré le 03/09/2026) — la question « on vous trouve où ? »
      return "presentation";
    case "S3": // la maquette, dès son oui
      return "douleur";
    case "S4":
      return "appel_propose";
    case "S5":
      return "questionnaire_envoye";
    default:
      return null; // R1-R3 : le stade ne bouge pas
  }
}

export const VALID_STEPS = new Set([
  "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9",
  "S1", "S2", "S3", "S4", "S5",
  "R1", "R2", "R3",
]);

/**
 * Prochain message de la séquence à envoyer, d'après le stade atteint —
 * l'inverse de `stageForStep`. Sert à pointer une étape dans la trame plutôt
 * que d'afficher douze messages sans repère.
 *
 * `null` quand la séquence n'a plus rien à proposer : après M9 la balle est
 * dans le camp du prospect (questionnaire puis call), et booké/perdu sont des
 * fins. Les relances n'en font pas partie : elles sont pilotées par
 * `next_followup_at`, pas par le stade.
 */
export function nextStepFor(stage: string | null, trame: Trame = "standard"): string | null {
  if (trame === "site") {
    switch (stage) {
      case null:
      case "":
        return "S1";
      // Dès qu'il a répondu, la maquette. `presentation` (un S2 envoyé avant
      // le 03/09/2026) mène au même endroit : ces prospects n'ont jamais reçu
      // leur aperçu, c'est précisément ce qui leur manque.
      case "accroche":
      case "receptif":
      case "presentation":
        return "S3";
      // `connexion` n'appartient pas à la trame site : elle ne peut y arriver
      // que posée à la main depuis le panneau. On ne coupe pas sa trame pour
      // autant — on l'envoie au message suivant dans l'ordre du tunnel.
      case "connexion":
      case "douleur":
        return "S4";
      case "appel_propose":
        return "S5";
      default:
        return null;
    }
  }
  switch (stage) {
    case null:
    case "":
      return "M1";
    case "accroche":
    // « Réceptif » dit qu'il a répondu, pas qu'on a répondu : l'étape à
    // envoyer reste M2. Sans ce cas il tomberait dans le `default` et le
    // panneau n'aurait plus rien à proposer — marquer un prospect réceptif
    // lui couperait sa trame.
    case "receptif":
      return "M2";
    case "presentation":
      return "M5";
    case "connexion":
      return "M7";
    case "douleur":
      return "M8";
    case "appel_propose":
      return "M9";
    default:
      // questionnaire_envoye, call_booke, perdu — et tout stade inconnu.
      return null;
  }
}

/**
 * Genres de réponse ENTRANTE (table `ig_replies`, migration 018).
 * `autorepondeur` ne compte pas comme une réponse humaine : ni dans les KPI, ni
 * pour sortir le prospect de la file de relance.
 */
export const REPLY_KINDS = ["positive", "neutre", "refus", "autorepondeur"] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];
