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
 * Trame d'un prospect JAMAIS accroché, déduite de ce qu'il a ou n'a pas.
 *
 * La trame site s'ouvre sur « quand quelqu'un vous cherche sur Google, il
 * tombe sur quoi ? » et pose sa maquette au 3ᵉ message : elle n'a de sens que
 * face à quelqu'un qui n'a pas de site. Face à quelqu'un qui en a un, c'est la
 * trame standard qui travaille.
 *
 * `has_website` inconnu compte comme sans site — même règle que `estSansSite`
 * dans `igSelection`, qui compose la journée. Si les deux divergeaient, la
 * sélection servirait des prospects que le panneau ouvrirait dans l'autre
 * trame. La règle n'est pas importée depuis `igSelection` : ce module embarque
 * les 450 Ko de `communes-fr.json`, qu'aucune des routes appelantes n'a à
 * traîner pour un test d'une ligne.
 */
async function trameParDefaut(prospectId: string): Promise<Trame> {
  const { data, error } = await supabase
    .from("instagram_prospects")
    .select("has_website")
    .eq("id", prospectId)
    .maybeSingle();
  // Lecture impossible : on ne devine pas, on reste sur la méthode complète.
  if (error || !data) return "standard";
  return data.has_website === true ? "standard" : "site";
}

/**
 * Trame à servir : demande explicite (bascule du panneau) > trame déjà
 * engagée > ce que le prospect a (site ou pas).
 *
 * L'explicite prime pour que la bascule ait un effet immédiat, y compris en
 * cours de conversation — c'est parfois exactement ce qu'on veut après une
 * réponse qui change la donne. L'engagé passe avant le déduit pour la raison
 * dite plus haut : ce qui est parti ne se renie pas.
 */
export async function resolveTrame(asked: string | null, prospectId: string | null): Promise<Trame> {
  const wanted = (asked ?? "").trim().toLowerCase();
  if ((TRAMES as readonly string[]).includes(wanted)) return wanted as Trame;
  if (!prospectId) return "standard";
  return (await engagedTrame(prospectId)) ?? (await trameParDefaut(prospectId));
}
