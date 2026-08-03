import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { TRAME_COLUMNS, type TrameProspect } from "@/app/lib/igTrame";
import { firstNameOf } from "@/app/lib/instagram";
import { MAX_HISTORY } from "@/app/lib/igReplyPrompt";
import {
  buildRetoneSystem,
  buildRetoneUser,
  parseVariants,
  MAX_RETONE,
  type RetoneContext,
} from "@/app/lib/igRetone";

export const dynamic = "force-dynamic";

const PRIMARY_MODEL = process.env.ANTHROPIC_RETONE_MODEL || "claude-sonnet-5";
const FALLBACK_MODEL = "claude-sonnet-4-6";

interface Body {
  username?: string;
  text?: string;
  history?: string;
}

/**
 * POST /api/instagram/retone  { username?, text, history? }
 * Rend la phrase de Nicolas en trois tons (calme / neutre / cash). Lecture
 * seule : n'écrit rien en base, ne journalise rien, n'envoie rien — il choisit
 * et il envoie lui-même.
 */
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Clé Anthropic absente : reformulation indisponible." }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const text = (body.text ?? "").trim().slice(0, MAX_RETONE);
  if (!text) return NextResponse.json({ error: "Rien à reformuler — le champ est vide." }, { status: 400 });
  const history = (body.history ?? "").trim().slice(0, MAX_HISTORY);
  const username = (body.username ?? "").replace(/^@/, "").trim().toLowerCase();

  try {
    // Le prospect est un BONUS, jamais une condition : hors base, Supabase
    // absent ou pseudo inconnu, on reformule quand même en restant générique.
    // Refuser ici serait un blocage gratuit — le panneau sait déjà travailler
    // sans prospect (il insère sans journaliser).
    let prospect: TrameProspect | null = null;
    if (username && supabaseConfigured) {
      const { data } = await supabase
        .from("instagram_prospects")
        .select(TRAME_COLUMNS)
        .eq("username", username)
        .maybeSingle();
      prospect = (data as TrameProspect | null) ?? null;
    }

    // La trame n'est pas construite : elle sert à ramener vers l'étape
    // suivante, or ici on ne ramène nulle part — on réécrit ce qui est déjà
    // écrit. La ligne prospect suffit à situer le ton.
    const ctx: RetoneContext = {
      prospect: prospect
        ? {
            username: prospect.username,
            firstName: firstNameOf(prospect.full_name),
            metier: prospect.metier,
            ville: prospect.ville,
            stage: prospect.stage,
          }
        : null,
      text,
      history,
    };

    const client = new Anthropic();
    const call = (model: string) =>
      client.messages.create({
        model,
        // Trois variantes en JSON : à l'étroit, la réponse est TRONQUÉE en
        // cours de route et le panneau affiche « rien proposé » alors que le
        // modèle avait répondu.
        max_tokens: 3000,
        system: buildRetoneSystem(ctx),
        messages: [{ role: "user", content: buildRetoneUser(ctx) }],
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
    const variants = parseVariants(raw);
    if (!variants.length) {
      // Diagnostic dans la réponse : « rien proposé » tout seul envoie
      // chercher au mauvais endroit.
      return NextResponse.json(
        {
          error: "Le modèle n'a rien proposé — reformule ta phrase, ou raccourcis-la.",
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
    return NextResponse.json({ variants });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
