import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { buildSparSystemPrompt, parseSparTurn, MAX_SPAR_HISTORY } from "@/app/lib/igSparPrompt";

export const dynamic = "force-dynamic";

const PRIMARY_MODEL = process.env.ANTHROPIC_SPAR_MODEL || "claude-sonnet-5";
const FALLBACK_MODEL = "claude-sonnet-4-6";

interface Body {
  metier?: string;
  ville?: string;
  step?: string;
  stepText?: string;
  /** Le fil d'entraînement (`moi:` / `lui:`). */
  history?: string;
  /** Ce que Nicolas vient d'écrire. */
  message?: string;
}

/**
 * POST /api/instagram/spar — un tour d'entraînement.
 *
 * L'outil aide à envoyer ; il ne rend pas meilleur. C'est le seul adversaire
 * qu'on peut affronter cinquante fois sans brûler un vrai prospect.
 *
 * Aucune écriture : ni prospect, ni envoi, ni stade. Rien de ce qui se passe
 * ici ne doit toucher les compteurs — sinon s'entraîner ferait mentir les KPI.
 */
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY absente" }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Écris ton message d'abord." }, { status: 400 });

  // Les objections viennent de la vraie boîte : c'est ce qui distingue cet
  // entraînement d'un jeu de rôle générique.
  let refus: string[] = [];
  if (supabaseConfigured) {
    const { data } = await supabase
      .from("ig_replies")
      .select("excerpt")
      .eq("kind", "refus")
      .not("excerpt", "is", null)
      .order("received_at", { ascending: false })
      .limit(8);
    refus = ((data ?? []) as { excerpt: string | null }[])
      .map((r) => (r.excerpt ?? "").trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  const ctx = {
    metier: (body.metier ?? "").trim() || "artisan",
    ville: (body.ville ?? "").trim() || null,
    step: (body.step ?? "").trim() || null,
    stepText: (body.stepText ?? "").trim() || null,
    refus,
    history: (body.history ?? "").trim().slice(0, MAX_SPAR_HISTORY),
  };

  try {
    const client = new Anthropic();
    const call = (model: string) =>
      client.messages.create({
        model,
        max_tokens: 800,
        system: buildSparSystemPrompt(ctx),
        messages: [
          {
            role: "user",
            content: ctx.history
              ? `Le fil jusqu'ici :\n${ctx.history}\n\nSon nouveau message :\n${message}`
              : `Son premier message :\n${message}`,
          },
        ],
      });

    let msg;
    try {
      msg = await call(PRIMARY_MODEL);
    } catch (e) {
      const notFound = e instanceof Anthropic.APIError && (e.status === 404 || e.status === 400);
      if (!notFound || PRIMARY_MODEL === FALLBACK_MODEL) throw e;
      msg = await call(FALLBACK_MODEL);
    }

    const raw = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    const turn = parseSparTurn(raw);
    if (!turn) return NextResponse.json({ error: "Tour illisible — rejoue." }, { status: 502 });
    return NextResponse.json({ turn, objections: refus.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
