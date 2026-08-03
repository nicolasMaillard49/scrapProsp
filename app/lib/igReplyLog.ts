// app/lib/igReplyLog.ts
// Écriture d'une réponse ENTRANTE dans le CRM — extraite de la route
// /api/instagram/reply pour que l'extension puisse journaliser exactement de
// la même façon, sans dupliquer la règle métier ni exposer le DELETE de cette
// route à l'en-tête d'extension.

import { supabase } from "./supabase";
import { REPLY_KINDS, type ReplyKind } from "./igPipeline";

export interface LogReplyInput {
  prospect_id: string;
  kind: string;
  account_id?: string | null;
  received_at?: string;
  excerpt?: string | null;
}

export type LogReplyResult =
  | { ok: true; reply: unknown; prospect: unknown }
  | { ok: false; error: string; status: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalise un identifiant venant d'un formulaire.
 *
 * Une chaîne VIDE n'est pas un uuid : Postgres refuse `""` avec
 * « invalid input syntax for type uuid » — une erreur 500 illisible pour une
 * cause triviale (un `useState<string>("")` non gardé côté page). Ici, vide
 * vaut « pas de compte », et une valeur mal formée est signalée telle quelle
 * plutôt que renvoyée à la base.
 */
export function asUuidOrNull(v: unknown): { value: string | null; malformed: boolean } {
  if (typeof v !== "string") return { value: null, malformed: false };
  const t = v.trim();
  if (!t) return { value: null, malformed: false };
  return UUID_RE.test(t) ? { value: t, malformed: false } : { value: null, malformed: true };
}

/**
 * Journalise une réponse du prospect et en tire les conséquences métier.
 *
 * Effet de bord voulu : un prospect qui vient de répondre SORT de la file de
 * relance (`next_followup_at = null`). On lui doit une réponse, pas une
 * relance. Les autorépondeurs ne déclenchent pas cette sortie : personne n'a
 * rien lu. Les compteurs (`reply_count`, `first_reply_at`, `last_reply_at`)
 * sont recalculés par le trigger de la migration 018 — on n'y touche pas.
 */
export async function logReply(input: LogReplyInput): Promise<LogReplyResult> {
  const kind = (input.kind ?? "").toLowerCase() as ReplyKind;
  const pid = asUuidOrNull(input.prospect_id);
  if (!pid.value) {
    return { ok: false, error: pid.malformed ? "prospect_id invalide" : "prospect_id requis", status: 400 };
  }
  const acc = asUuidOrNull(input.account_id);
  if (acc.malformed) return { ok: false, error: "account_id invalide", status: 400 };
  if (!REPLY_KINDS.includes(kind)) {
    return { ok: false, error: `kind invalide (${kind}) — attendu : ${REPLY_KINDS.join(", ")}`, status: 400 };
  }
  const prospectId = pid.value;
  const accountId = acc.value;

  const receivedAt = input.received_at ? new Date(input.received_at) : new Date();
  if (Number.isNaN(receivedAt.getTime())) return { ok: false, error: "received_at invalide", status: 400 };

  const { data: prospect, error: prosErr } = await supabase
    .from("instagram_prospects")
    .select("id, username, status")
    .eq("id", prospectId)
    .single();
  if (prosErr || !prospect) return { ok: false, error: "prospect introuvable", status: 404 };

  const { data: reply, error: insErr } = await supabase
    .from("ig_replies")
    .insert({
      prospect_id: prospectId,
      account_id: accountId,
      kind,
      received_at: receivedAt.toISOString(),
      excerpt: input.excerpt?.slice(0, 500) ?? null,
    })
    .select("id, kind, received_at, excerpt")
    .single();
  if (insErr) return { ok: false, error: insErr.message, status: 500 };

  const patch: Record<string, unknown> = {};
  if (kind !== "autorepondeur") patch.next_followup_at = null;
  if (prospect.status === "todo") patch.status = "contacted";

  const cols = "id, status, stage, next_followup_at, reply_count, first_reply_at, last_reply_at";
  let updated: unknown = null;
  if (Object.keys(patch).length > 0) {
    const { data, error: upErr } = await supabase
      .from("instagram_prospects")
      .update(patch)
      .eq("id", prospectId)
      .select(cols)
      .single();
    if (upErr) return { ok: false, error: upErr.message, status: 500 };
    updated = data;
  } else {
    const { data } = await supabase.from("instagram_prospects").select(cols).eq("id", prospectId).single();
    updated = data;
  }

  return { ok: true, reply, prospect: updated };
}
