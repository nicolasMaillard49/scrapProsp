import { supabase } from "./supabase";
import { STAGES, type Stage } from "./igPipeline";

/**
 * L'ÉCRIVAIN UNIQUE du stade.
 *
 * Il existait trois chemins pour poser un stade, et ils ne posaient pas la
 * même chose :
 *  - `PATCH /api/instagram/[id]` appliquait la cohérence (statut, relances) ;
 *  - `markLostFromSelection` l'appliquait ET écartait la ligne du jour ;
 *  - `POST /api/instagram/classify-reply { record: "stage" }` faisait un
 *    `update({ stage })` NU — donc un prospect recalé « perdu » depuis
 *    l'extension gardait son statut et sa relance programmée, et revenait
 *    dans la file.
 *
 * Un stade qui veut dire trois choses différentes selon la porte empruntée
 * n'est pas un stade. Tout passe désormais ici.
 */

/** Le patch à appliquer sur `instagram_prospects` pour un stade donné. Pur. */
export function stagePatch(stage: Stage): {
  stage: Stage;
  status?: "positive" | "negative";
  next_followup_at?: null;
} {
  // Cohérence stade ↔ statut : les deux issues TERMINALES coupent les
  // relances. Un prospect booké qu'on relance est un impair ; un prospect
  // perdu qu'on relance est le bug qu'on vient de corriger.
  if (stage === "call_booke") return { stage, status: "positive", next_followup_at: null };
  if (stage === "perdu") return { stage, status: "negative", next_followup_at: null };
  return { stage };
}

/**
 * Le stade ferme-t-il la ligne de la sélection du jour ?
 *
 * Seulement « perdu ». Les stades intermédiaires se posent EN COURS de
 * conversation — écarter la ligne à ce moment-là retirerait de la journée un
 * prospect qu'on est justement en train de travailler. Et « call_booke » non
 * plus : le DM est parti, la ligne reste comptée aux KPI de la journée.
 */
export function closesDayLine(stage: Stage): boolean {
  return stage === "perdu";
}

/** Valide une chaîne venue du réseau. `null` si ce n'est pas un stade connu. */
export function parseStage(raw: unknown): Stage | null {
  const s = String(raw ?? "").toLowerCase().trim();
  return (STAGES as readonly string[]).includes(s) ? (s as Stage) : null;
}

/**
 * Écarte la ligne du jour — écartée, PAS supprimée : elle reste visible,
 * grisée, et ne sera pas reportée demain.
 *
 * Filtrée sur les lignes OUVERTES : un prospect absent de la sélection (ou
 * déjà traité) ne fait pas d'erreur, l'update touche simplement 0 ligne.
 */
export async function closeDayLine(prospectId: string, reason?: string | null): Promise<void> {
  const { error } = await supabase
    .from("ig_daily_selection")
    .update({ skipped_at: new Date().toISOString(), skip_reason: reason ?? "perdu — injoignable" })
    .eq("prospect_id", prospectId)
    .is("done_at", null)
    .is("skipped_at", null);
  if (error) throw new Error(`sélection : ${error.message}`);
}

/** Pose le stade et tout ce qui en découle. */
export async function setStage(prospectId: string, stage: Stage, reason?: string | null): Promise<void> {
  const { error } = await supabase
    .from("instagram_prospects")
    .update(stagePatch(stage))
    .eq("id", prospectId);
  if (error) throw new Error(`prospect : ${error.message}`);

  if (closesDayLine(stage)) await closeDayLine(prospectId, reason);
}
