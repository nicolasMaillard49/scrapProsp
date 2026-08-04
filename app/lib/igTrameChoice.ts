// app/lib/igTrameChoice.ts
// Quelle trame déroule-t-on avec ce prospect ? Réponse partagée par toutes les
// routes qui rendent la séquence (trame, reply-ai) — sans ça, le panneau
// afficherait S3 pendant que la réponse IA raisonnerait sur M7.
//
// Volontairement HORS de `igTrame.ts`, qui est une construction pure et testée
// comme telle : ici on lit la base.

import { supabase } from "./supabase";
import { TRAMES, trameOfStep, type Trame } from "./igPipeline";

/** Nombre d'envois remontés pour retrouver la dernière étape de séquence. */
const LOOKBACK = 20;

/**
 * Trame déjà engagée avec ce prospect, lue dans le journal d'envois.
 *
 * Le choix de trame ne peut pas vivre uniquement dans le `storage` de
 * l'extension : vidé, ou consulté depuis un autre poste, une conversation
 * commencée en trame site repartirait en standard au message suivant — le
 * prospect verrait deux méthodes s'entrechoquer au milieu d'un échange. Ce
 * qui a réellement ÉTÉ ENVOYÉ est la seule source qui ne ment pas.
 */
export async function engagedTrame(prospectId: string): Promise<Trame | null> {
  const { data } = await supabase
    .from("ig_dm_log")
    .select("step")
    .eq("prospect_id", prospectId)
    .order("sent_at", { ascending: false })
    .limit(LOOKBACK);

  for (const row of (data ?? []) as { step: string }[]) {
    // Les relances n'appartiennent à aucune trame : on remonte jusqu'au
    // dernier message de séquence réellement parti.
    const t = trameOfStep(row.step);
    if (t) return t;
  }
  return null;
}

/**
 * Trame à servir : demande explicite (bascule du panneau) > trame déjà
 * engagée > standard.
 *
 * L'explicite prime pour que la bascule ait un effet immédiat, y compris en
 * cours de conversation — c'est parfois exactement ce qu'on veut après une
 * réponse qui change la donne.
 */
export async function resolveTrame(asked: string | null, prospectId: string | null): Promise<Trame> {
  const wanted = (asked ?? "").trim().toLowerCase();
  if ((TRAMES as readonly string[]).includes(wanted)) return wanted as Trame;
  if (!prospectId) return "standard";
  return (await engagedTrame(prospectId)) ?? "standard";
}
