// app/lib/igDmLog.ts
// Le journal des envois — logique PURE, partagée par l'API, le cron Slack et les KPI.
//
// Deux invariants vivent ici, tous deux appris d'un même bug : le 05/08, le
// compteur du jour affichait 75 accroches pour 49 prospects réellement
// démarchés.
//
//  1. UNICITÉ — un envoi, c'est un (prospect, étape, jour civil Paris). Trois
//     chemins journalisent le même message (détection d'envoi, auto-détection
//     du champ vidé, bouton « Envoyé ») : sans clé d'unicité, le même DM
//     s'inscrivait deux ou trois fois. `parisDayKey` fabrique le troisième
//     terme de cette clé, côté app comme côté base (colonne `sent_day`).
//
//  2. UN MESSAGE ENVOYÉ EST UNE ACCROCHE. Les M2-M9 / S2-S5 sont la suite
//     d'une conversation déjà engagée — le plus souvent une RÉPONSE à ce que
//     le prospect vient d'écrire. Les compter comme des envois gonfle le
//     chiffre et écrase le taux de réponse, dont l'accroche est le dénominateur.

import { isAccrocheStep } from "./igPipeline";

/**
 * Jour civil Europe/Paris (YYYY-MM-DD) d'un instant.
 *
 * Le fuseau, pas UTC : une accroche partie à 00 h 30 appartient au jour qui
 * commence, pas à celui qui vient de finir. `fr-CA` rend le format ISO tel
 * quel, et `Intl` suit le changement d'heure sans qu'on ait à le savoir.
 */
export function parisDayKey(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return d.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

export interface EnvoiCounts {
  /** M1 / S1 — les prises de contact. C'est « Messages envoyés ». */
  accroches: number;
  /** M2-M9 / S2-S5 — la conversation qui suit, réponses comprises. */
  suites: number;
  /** R1-R3. */
  relances: number;
  /** Toutes les lignes, tous types confondus. */
  total: number;
}

/**
 * Ventile un journal d'envois. Compte des LIGNES : c'est à l'écriture que
 * l'unicité se joue (contrainte `ig_dm_log_unique_envoi` + garde de l'API),
 * pas ici — un compteur qui « rattrape » des doublons masquerait leur cause.
 */
export function countEnvois(rows: { step: string }[]): EnvoiCounts {
  const c: EnvoiCounts = { accroches: 0, suites: 0, relances: 0, total: 0 };
  for (const r of rows) {
    c.total++;
    if (r.step.startsWith("R")) c.relances++;
    else if (isAccrocheStep(r.step)) c.accroches++;
    else c.suites++;
  }
  return c;
}

/**
 * La même ventilation, mais éclatée par JOUR CIVIL Paris — la maille de tous
 * les agrégats KPI (page /instagram/kpi et Google Sheet de tracking).
 */
export function envoisParJour(rows: { step: string; sent_at: string }[]): Map<string, EnvoiCounts> {
  const byDay = new Map<string, { step: string }[]>();
  for (const r of rows) {
    const d = parisDayKey(r.sent_at);
    const bucket = byDay.get(d);
    if (bucket) bucket.push(r);
    else byDay.set(d, [r]);
  }
  return new Map([...byDay].map(([d, rs]) => [d, countEnvois(rs)]));
}

/** Bloc « envois » d'une journée, tel que servi par GET /api/instagram/kpi. */
export interface EnvoiFields {
  /** LE compteur « messages envoyés » : accroches uniquement (cf. invariant 2). */
  sent: number;
  relances: number;
  /** Alias explicite de `sent` — même valeur, nom qui ne ment pas. */
  accroches: number;
  /** M2-M9 / S2-S5 : la conversation qui suit, comptée à part. */
  suite: number;
  /** Accroches + suite = tout le trafic de séquence (ancienne valeur de `sent`). */
  sentAll: number;
}

/**
 * Traduit un comptage en champs d'API. Existe pour que la règle « le chiffre
 * servi au Sheet = les accroches » soit VERROUILLÉE par un test, et non
 * réinventée dans une route où personne ne la relit.
 */
export function kpiEnvoiFields(c: EnvoiCounts): EnvoiFields {
  return {
    sent: c.accroches,
    relances: c.relances,
    accroches: c.accroches,
    suite: c.suites,
    sentAll: c.accroches + c.suites,
  };
}
