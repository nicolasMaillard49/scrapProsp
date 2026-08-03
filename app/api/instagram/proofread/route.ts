import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cleanProofread, buildProofreadSystem, MAX_PROOFREAD } from "@/app/lib/igProofread";

export const dynamic = "force-dynamic";

/** Tâche mécanique et courte : un petit modèle suffit, et il répond vite. */
const PRIMARY_MODEL = process.env.ANTHROPIC_PROOFREAD_MODEL || "claude-haiku-4-5-20251001";
const FALLBACK_MODEL = "claude-sonnet-4-6";

/**
 * POST /api/instagram/proofread  { text }
 * Corrige l'orthographe d'un DM sans en changer le sens ni le ton.
 * Lecture seule : n'écrit rien en base, n'envoie rien.
 */
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Clé Anthropic absente : correction indisponible." }, { status: 503 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const original = (body.text ?? "").slice(0, MAX_PROOFREAD);
  if (!original.trim()) return NextResponse.json({ error: "Rien à corriger — le champ est vide." }, { status: 400 });

  try {
    const client = new Anthropic();
    const call = (model: string) =>
      client.messages.create({
        model,
        max_tokens: 1000,
        system: buildProofreadSystem(),
        messages: [{ role: "user", content: original }],
      });

    let msg;
    try {
      msg = await call(PRIMARY_MODEL);
    } catch (e) {
      const notFound = e instanceof Anthropic.APIError && (e.status === 404 || e.status === 400);
      if (!notFound || PRIMARY_MODEL === FALLBACK_MODEL) throw e;
      msg = await call(FALLBACK_MODEL);
    }

    const raw = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const text = cleanProofread(raw, original);
    return NextResponse.json({ text, changed: text !== original });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
