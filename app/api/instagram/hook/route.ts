import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { buildTrame, TRAME_COLUMNS, type TrameProspect } from "@/app/lib/igTrame";
import { resolveTrame } from "@/app/lib/igTrameChoice";
import { firstNameOf } from "@/app/lib/instagram";
import { buildHookSystemPrompt, parseHookVariants, MAX_HOOK_INPUT } from "@/app/lib/igHookPrompt";

export const dynamic = "force-dynamic";

const PRIMARY_MODEL = process.env.ANTHROPIC_HOOK_MODEL || "claude-sonnet-5";
const FALLBACK_MODEL = "claude-sonnet-4-6";

interface Body {
  username?: string;
  /** Bio lue sur la page du prospect. */
  bio?: string;
  /** Descriptions des dernières publications, telles qu'affichées. */
  posts?: string[];
  trame?: string;
}

/**
 * POST /api/instagram/hook  { username, bio?, posts?, trame? }
 *
 * L'accroche vivante : réécrit M1/S1 autour d'UNE observation tirée de la page
 * du prospect. Lecture seule — le panneau insère, l'humain envoie, et c'est
 * `matchStep` qui rattachera l'envoi à l'étape (la variante reste assez proche
 * de l'accroche standard pour être reconnue).
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY absente" }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const username = (body.username ?? "").replace(/^@/, "").trim().toLowerCase();
  const bio = (body.bio ?? "").trim().slice(0, MAX_HOOK_INPUT);
  const posts = (Array.isArray(body.posts) ? body.posts : [])
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .slice(0, 4);

  // Sans matière, il n'y a rien à personnaliser — et une accroche « vivante »
  // fabriquée dans le vide serait une accroche inventée.
  if (!bio && !posts.length) {
    return NextResponse.json({ error: "Rien à lire sur cette page — ouvre son profil, pas la conversation." }, { status: 422 });
  }

  try {
    const { data } = username
      ? await supabase.from("instagram_prospects").select(TRAME_COLUMNS).eq("username", username).maybeSingle()
      : { data: null };
    const prospect = (data as TrameProspect | null) ?? null;

    const kind = await resolveTrame(body.trame ?? null, prospect?.id ?? null);
    const trame = buildTrame(prospect, "", kind);
    // L'accroche est la PREMIÈRE étape de la trame servie — M1 ou S1 selon le
    // cas. On ne la code pas en dur : la trame site n'a pas de M1.
    const base = trame.steps.find((s) => /^[MS]1$/.test(s.step));
    if (!base) return NextResponse.json({ error: "Aucune accroche dans cette trame." }, { status: 500 });

    const ctx = {
      base: base.text,
      firstName: firstNameOf(prospect?.full_name ?? null),
      metier: prospect?.metier ?? null,
      ville: prospect?.ville ?? null,
      bio,
      posts,
    };

    const client = new Anthropic();
    const call = (model: string) =>
      client.messages.create({
        model,
        max_tokens: 1200,
        system: buildHookSystemPrompt(ctx),
        messages: [{ role: "user", content: "Propose les variantes." }],
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
    const variants = parseHookVariants(raw);
    if (!variants.length) {
      return NextResponse.json(
        { error: "Aucune variante exploitable — l'accroche standard reste la bonne." },
        { status: 502 },
      );
    }
    return NextResponse.json({ variants, step: base.step, base: base.text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
