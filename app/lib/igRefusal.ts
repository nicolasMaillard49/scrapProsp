// app/lib/igRefusal.ts
// « Refus » — le geste composite.
//
// Un refus n'est pas un stade : c'est une RÉPONSE de genre `refus`
// (`ig_replies.kind`) qui vaut aussi fin de conversation. Les deux axes du
// CRM doivent bouger ensemble, sinon le KPI et le pipeline se contredisent :
//   - `ig_replies.kind = "refus"` → colonne F du Sheet, taux de réponse ;
//   - `stage = "perdu"`           → sortie du pipeline, relances coupées.
//
// C'est aussi ce qui le distingue de « Perdu » tout court : un compte
// injoignable qui n'a JAMAIS parlé n'est pas un refus, et le compter comme tel
// gonflerait le taux de réponse négative avec des gens muets.

import { supabase } from "./supabase";
import { parisDayStart } from "./igCockpit";
import { logReply } from "./igReplyLog";
import { setStage } from "./igStage";

/**
 * Que faire de la réponse du jour ? Décision pure, donc testable.
 *
 * La règle du KPI est « une réponse par prospect et par jour, la plus
 * significative » (`strongest()` dans kpi/route.ts). Ajouter une SECONDE ligne
 * ne changerait donc aucun compteur — mais laisserait le journal mentir sur ce
 * qui s'est dit. On RECLASSE la ligne du jour au lieu d'en empiler une.
 */
export function refusalAction(todaysReplyId: string | null): "reclass" | "insert" {
  return todaysReplyId ? "reclass" : "insert";
}

export type RefusalResult = { ok: true; action: "reclass" | "insert" } | { ok: false; error: string; status: number };

/**
 * Marque le refus : la réponse du jour passe en `refus` (ou est créée si le
 * prospect n'en avait aucune aujourd'hui), puis le prospect sort du pipeline.
 */
export async function markRefusal(
  prospectId: string,
  opts: { accountId?: string | null; excerpt?: string | null } = {},
): Promise<RefusalResult> {
  const { data: today, error: selErr } = await supabase
    .from("ig_replies")
    .select("id")
    .eq("prospect_id", prospectId)
    .gte("received_at", parisDayStart().toISOString())
    .order("received_at", { ascending: false })
    .limit(1);
  if (selErr) return { ok: false, error: selErr.message, status: 500 };

  const existing = today?.[0]?.id ?? null;
  const action = refusalAction(existing);

  if (action === "reclass") {
    // Reclassement : le genre change, l'extrait d'origine reste — c'est lui
    // qui documente ce que le prospect avait réellement écrit.
    const { error } = await supabase.from("ig_replies").update({ kind: "refus" }).eq("id", existing);
    if (error) return { ok: false, error: error.message, status: 500 };
  } else {
    const r = await logReply({
      prospect_id: prospectId,
      kind: "refus",
      account_id: opts.accountId ?? null,
      excerpt: opts.excerpt ?? null,
    });
    if (!r.ok) return { ok: false, error: r.error, status: r.status };
  }

  await setStage(prospectId, "perdu", "refus");
  return { ok: true, action };
}
