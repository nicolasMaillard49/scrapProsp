import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { buildTrame, TRAME_COLUMNS, type TrameProspect } from "@/app/lib/igTrame";
import { resolveTrame } from "@/app/lib/igTrameChoice";
import { firstNameOf } from "@/app/lib/instagram";
import {
  buildReplySystemPrompt,
  buildReplyUserMessage,
  parseSuggestions,
  MAX_INCOMING,
  MAX_HISTORY,
} from "@/app/lib/igReplyPrompt";

export const dynamic = "force-dynamic";

/**
 * Modèle de la réponse assistée. Repli automatique si le modèle demandé n'est
 * pas disponible sur la clé : la fonctionnalité ne doit pas mourir sur un nom
 * de modèle, elle doit répondre.
 */
const PRIMARY_MODEL = process.env.ANTHROPIC_REPLY_MODEL || "claude-sonnet-5";
const FALLBACK_MODEL = "claude-sonnet-4-6";

interface Body {
  username?: string;
  incoming?: string;
  history?: string;
  /** Trame déroulée dans le panneau ; à défaut, déduite du journal d'envois. */
  trame?: string;
}

/**
 * POST /api/instagram/reply-ai  { username, incoming, history? }
 * Propose 3 réponses courtes quand le prospect sort de la trame. Lecture seule :
 * n'écrit rien, ne journalise rien, n'envoie rien — c'est une aide à la
 * rédaction, l'humain choisit, corrige et envoie.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Clé Anthropic absente : réponse IA indisponible." }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const incoming = (body.incoming ?? "").trim().slice(0, MAX_INCOMING);
  if (!incoming) return NextResponse.json({ error: "Colle le message du prospect d'abord." }, { status: 400 });
  const history = (body.history ?? "").trim().slice(0, MAX_HISTORY);
  const username = (body.username ?? "").replace(/^@/, "").trim().toLowerCase();

  try {
    const { data, error } = username
      ? await supabase.from("instagram_prospects").select(TRAME_COLUMNS).eq("username", username).maybeSingle()
      : { data: null, error: null };
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const prospect = (data as TrameProspect | null) ?? null;
    // buildTrame reste la seule source de la séquence et du nextStep — et il
    // faut la MÊME trame que celle affichée dans le panneau, sinon le modèle
    // ramène la conversation vers une étape qui n'existe pas dans la partition
    // déroulée avec ce prospect.
    const base = (process.env.NEXT_PUBLIC_DEMO_BASE_URL ?? "").replace(/\/$/, "") || req.nextUrl.origin;
    const kind = await resolveTrame(body.trame ?? null, prospect?.id ?? null);
    const trame = buildTrame(prospect, base, kind);

    const ctx = {
      prospect: prospect
        ? {
            username: prospect.username,
            firstName: firstNameOf(prospect.full_name),
            metier: prospect.metier,
            ville: prospect.ville,
            stage: prospect.stage,
          }
        : null,
      steps: trame.steps,
      nextStep: trame.nextStep,
      incoming,
      history,
    };

    const client = new Anthropic();
    const call = (model: string) =>
      client.messages.create({
        model,
        // Large : trois propositions en JSON avec un prompt système fourni.
        // À 700, la réponse était TRONQUÉE en cours de JSON — le panneau
        // affichait « le modèle n'a rien proposé » alors qu'il avait répondu.
        max_tokens: 3000,
        system: buildReplySystemPrompt(ctx),
        messages: [{ role: "user", content: buildReplyUserMessage(ctx) }],
      });

    let msg;
    try {
      msg = await call(PRIMARY_MODEL);
    } catch (e) {
      const notFound = e instanceof Anthropic.APIError && (e.status === 404 || e.status === 400);
      if (!notFound || PRIMARY_MODEL === FALLBACK_MODEL) throw e;
      msg = await call(FALLBACK_MODEL);
    }

    const raw = msg.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    const suggestions = parseSuggestions(raw);
    if (!suggestions.length) {
      // Diagnostic dans la réponse : « rien proposé » sans rien d'autre
      // envoie chercher au mauvais endroit (on a cru à une troncature alors
      // que le modèle ne rendait aucun bloc texte).
      return NextResponse.json(
        {
          error: "Le modèle n'a rien proposé — reformule le message du prospect.",
          debug: {
            model: msg.model,
            stopReason: msg.stop_reason,
            blocks: msg.content.map((c) => c.type),
            rawLength: raw.length,
            outputTokens: msg.usage?.output_tokens ?? null,
          },
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ suggestions, nextStep: trame.nextStep });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
