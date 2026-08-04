// app/lib/igVariants.ts
// Le tirage des variantes d'accroche, et le verdict qu'on en tire.
//
// Bandit epsilon-greedy : la plupart du temps on joue la meilleure variante
// connue, et de temps en temps on en essaie une autre. Pourquoi pas un simple
// A/B 50/50 : un A/B fait payer la moitié des accroches au perdant pendant
// toute la durée du test. Ici le coût de l'exploration est borné à ε, et il
// diminue de lui-même à mesure que l'écart se creuse.
//
// Tolérant à l'absence de la table (migration 026 non jouée) : tout retombe
// sur « aucune variante », c'est-à-dire la trame telle qu'elle est écrite.

import { supabase } from "./supabase";

export interface Variant {
  id: string;
  step: string;
  label: string;
  text: string;
  sent: number;
  replied: number;
}

/** Part d'exploration : une accroche sur cinq teste autre chose que le champion. */
export const EPSILON = 0.2;

/**
 * En dessous, un taux de réponse ne veut rien dire : sur 10 envois, une seule
 * réponse fait 10 % et deux en font 20 %. On explore à égalité tant que ce
 * seuil n'est pas franchi.
 */
export const MIN_SENT = 30;

/** Écart à partir duquel on ose annoncer un gagnant (en points de pourcentage). */
export const DECISIVE_GAP = 0.05;

/**
 * Remplit les gabarits d'une variante : {prenom} {hello} {metier} {lieu} {ville}.
 *
 * Rend `null` dès qu'un gabarit utilisé n'a pas de valeur. C'est la règle qui
 * compte : une variante à trous partirait en DM avec « vous êtes toujours  ? »
 * ou, pire, un « {metier} » littéral. Mieux vaut retomber sur l'accroche
 * standard — elle, sait se passer de ce qu'elle n'a pas.
 */
export function fillVariant(text: string, vars: Readonly<Record<string, string>> | object): string | null {
  const table = vars as Record<string, string | undefined>;
  let manque = false;
  const out = String(text ?? "").replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = (table[key] ?? "").trim();
    if (!v) manque = true;
    return v;
  });
  if (manque) return null;
  return out.replace(/\s+/g, " ").trim() || null;
}

export async function activeVariants(step: string): Promise<Variant[]> {
  const { data, error } = await supabase
    .from("ig_trame_variants")
    .select("id, step, label, text, sent, replied")
    .eq("step", step)
    .eq("active", true);
  if (error) return []; // table absente : la trame écrite fait foi
  return (data ?? []) as Variant[];
}

export const rate = (v: Variant): number => (v.sent > 0 ? v.replied / v.sent : 0);

/**
 * Choisit la variante à envoyer.
 *
 * `roll` est injectable : un tirage aléatoire non injectable est un tirage non
 * testable, et c'est précisément la partie qu'on veut pouvoir prouver.
 */
export function chooseVariant(variants: Variant[], roll: () => number = Math.random): Variant | null {
  const list = variants.filter((v) => v.text?.trim());
  if (!list.length) return null;
  if (list.length === 1) return list[0];

  // Toute variante encore sous le seuil est prioritaire : sans données, la
  // « meilleure » n'est qu'un accident de petits nombres.
  const jeunes = list.filter((v) => v.sent < MIN_SENT);
  if (jeunes.length) return jeunes[Math.floor(roll() * jeunes.length) % jeunes.length];

  if (roll() < EPSILON) {
    // Exploration : n'importe laquelle SAUF le champion — réessayer le
    // champion n'apprend rien de neuf.
    const champion = best(list)!;
    const autres = list.filter((v) => v.id !== champion.id);
    if (autres.length) return autres[Math.floor(roll() * autres.length) % autres.length];
  }
  return best(list);
}

export function best(list: Variant[]): Variant | null {
  if (!list.length) return null;
  return list.reduce((a, b) => (rate(b) > rate(a) ? b : a));
}

/**
 * Le verdict, quand il y en a un.
 *
 * On ne parle que si les deux premières ont dépassé le seuil ET que l'écart
 * est net. Annoncer un gagnant sur du bruit est pire que se taire : ça fait
 * remplacer une accroche qui marche.
 */
export function verdict(list: Variant[]): { winner: Variant; runnerUp: Variant; gap: number } | null {
  const mures = list.filter((v) => v.sent >= MIN_SENT).sort((a, b) => rate(b) - rate(a));
  if (mures.length < 2) return null;
  const [winner, runnerUp] = mures;
  const gap = rate(winner) - rate(runnerUp);
  return gap >= DECISIVE_GAP ? { winner, runnerUp, gap } : null;
}

/** Une accroche vient de partir avec cette variante. */
export async function creditSent(variantId: string): Promise<void> {
  const { data } = await supabase.from("ig_trame_variants").select("sent").eq("id", variantId).maybeSingle();
  if (!data) return;
  await supabase
    .from("ig_trame_variants")
    .update({ sent: ((data as { sent: number }).sent ?? 0) + 1 })
    .eq("id", variantId);
}

/**
 * Ce prospect a répondu : sa variante d'accroche gagne un point.
 *
 * Appelé à l'inscription de la PREMIÈRE réponse seulement — le compteur mesure
 * « combien de prospects ont répondu », pas « combien de messages ont été
 * échangés », sinon une conversation bavarde ferait gagner sa variante.
 */
export async function creditReplied(prospectId: string): Promise<void> {
  const { data: p } = await supabase
    .from("instagram_prospects")
    .select("accroche_variant")
    .eq("id", prospectId)
    .maybeSingle();
  const id = (p as { accroche_variant: string | null } | null)?.accroche_variant;
  if (!id) return;
  const { data } = await supabase.from("ig_trame_variants").select("replied").eq("id", id).maybeSingle();
  if (!data) return;
  await supabase
    .from("ig_trame_variants")
    .update({ replied: ((data as { replied: number }).replied ?? 0) + 1 })
    .eq("id", id);
}
