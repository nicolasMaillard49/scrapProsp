import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { buildClassifySystemPrompt, parseVerdict } from "@/app/lib/igClassify";
import { STAGES } from "@/app/lib/igPipeline";
import { logReply } from "@/app/lib/igReplyLog";
import { MAX_HISTORY } from "@/app/lib/igReplyPrompt";

export const dynamic = "force-dynamic";

const PRIMARY_MODEL = process.env.ANTHROPIC_CLASSIFY_MODEL || "claude-sonnet-5";
const FALLBACK_MODEL = "claude-sonnet-4-6";

interface Body {
  username?: string;
  history?: string;
  /**
   * Écriture dans le CRM — seulement après validation humaine.
   * `"reply"` (ou `true`) journalise la réponse ; `"stage"` recale le stade.
   */
  record?: boolean | "reply" | "stage";
  kind?: string;
  excerpt?: string;
  account_id?: string;
  stage?: string;
}

/**
 * POST /api/instagram/classify-reply
 *
 * Deux usages, un seul endroit :
 *  - `{ username, history }` → QUALIFIE la réponse à froid (lecture seule) ;
 *  - `{ username, record: true, kind, excerpt }` → INSCRIT la réponse au CRM.
 *
 * L'écriture est séparée de la qualification à dessein : une qualification
 * fausse écrite d'office sortirait le prospect de la file de relance et
 * fausserait les KPI d'accroche. Le modèle propose, l'humain valide.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const username = (body.username ?? "").replace(/^@/, "").trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "username requis" }, { status: 400 });

  const { data: prospect, error } = await supabase
    .from("instagram_prospects")
    .select("id, username, stage, status, reply_count")
    .eq("username", username)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!prospect) return NextResponse.json({ error: `@${username} n'est pas dans la base.` }, { status: 404 });

  // ── Recalage du stade (après validation humaine) ─────────────────────────
  if (body.record === "stage") {
    const stage = (body.stage ?? "").toLowerCase().trim();
    if (!(STAGES as readonly string[]).includes(stage)) {
      return NextResponse.json({ error: `stade invalide (${stage})` }, { status: 400 });
    }
    const { data, error: upErr } = await supabase
      .from("instagram_prospects")
      .update({ stage })
      .eq("id", prospect.id)
      .select("id, stage, status, reply_count")
      .single();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, recorded: "stage", prospect: data });
  }

  // ── Écriture CRM (après validation humaine) ──────────────────────────────
  if (body.record) {
    const r = await logReply({
      prospect_id: prospect.id as string,
      kind: body.kind ?? "",
      account_id: body.account_id ?? null,
      excerpt: body.excerpt ?? null,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, recorded: true, prospect: r.prospect });
  }

  // ── Qualification (lecture seule) ────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Clé Anthropic absente : qualification indisponible." }, { status: 503 });
  }
  const history = (body.history ?? "").trim().slice(0, MAX_HISTORY);
  if (!history) return NextResponse.json({ error: "Fil de conversation vide — relis le fil d'abord." }, { status: 400 });

  try {
    const client = new Anthropic();
    const call = (model: string) =>
      client.messages.create({
        model,
        max_tokens: 1500,
        system: buildClassifySystemPrompt(),
        messages: [{ role: "user", content: history }],
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
    const verdict = parseVerdict(raw);
    if (!verdict) {
      // Diagnostic embarqué : sans lui, « non concluante » ne dit pas si le
      // modèle a été coupé, a refusé, ou a rendu autre chose que du JSON.
      return NextResponse.json(
        {
          error: "Qualification non concluante — à saisir à la main.",
          debug: {
            model: msg.model,
            stopReason: msg.stop_reason,
            blocks: msg.content.map((c) => c.type),
            rawLength: raw.length,
            rawHead: raw.slice(0, 200),
          },
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      verdict,
      prospect: { id: prospect.id, username: prospect.username, stage: prospect.stage, replyCount: prospect.reply_count },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
