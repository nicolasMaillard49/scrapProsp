import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { buildClassifySystemPrompt, parseVerdict } from "@/app/lib/igClassify";
import { parseStage, setStage } from "@/app/lib/igStage";
import { logReply } from "@/app/lib/igReplyLog";
import { MAX_HISTORY } from "@/app/lib/igReplyPrompt";
import { parisDayStart } from "@/app/lib/igCockpit";

export const dynamic = "force-dynamic";

const PRIMARY_MODEL = process.env.ANTHROPIC_CLASSIFY_MODEL || "claude-sonnet-5";
const FALLBACK_MODEL = "claude-sonnet-4-6";

interface Body {
  username?: string;
  history?: string;
  /**
   * Journalisation automatique (extension) : qualifie PUIS inscrit, sans clic,
   * mais uniquement sur confiance haute. Le doute reste à l'humain.
   */
  auto?: boolean;
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
    const stage = parseStage(body.stage);
    if (!stage) return NextResponse.json({ error: `stade invalide (${body.stage ?? ""})` }, { status: 400 });
    try {
      // Passe par l'écrivain unique : jusqu'ici c'était un `update({ stage })`
      // nu, donc un « perdu » posé depuis l'extension gardait son statut et sa
      // relance programmée — le prospect revenait dans la file.
      await setStage(prospect.id as string, stage, "perdu — clos depuis l'extension");
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
    const { data } = await supabase
      .from("instagram_prospects")
      .select("id, stage, status, reply_count")
      .eq("id", prospect.id)
      .single();
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
    // ── Journalisation automatique (extension) ─────────────────────────────
    // L'humain reste seul juge du DOUTE : on n'inscrit que ce que le modèle
    // affirme avec une confiance haute. Le reste remonte au panneau pour un
    // clic. Ne rien inscrire du tout — ce qui était le cas jusqu'ici — laisse
    // le prospect dans la file de relance alors qu'il vient de répondre.
    const auto = body.auto === true
      ? await autoRecord(prospect.id as string, verdict, body.account_id ?? null)
      : undefined;

    return NextResponse.json({
      verdict,
      auto,
      prospect: { id: prospect.id, username: prospect.username, stage: prospect.stage, replyCount: prospect.reply_count },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export interface AutoRecordResult {
  recorded: boolean;
  /** Pourquoi rien n'a été inscrit — le panneau l'affiche tel quel. */
  reason?: "pas-de-reponse" | "doute" | "deja-journalisee" | "erreur";
  kind?: string;
  error?: string;
}

/**
 * Inscrit la réponse détectée par l'extension, sans clic — et seulement si le
 * modèle est SÛR.
 *
 * L'idempotence est ici, côté serveur, et pas seulement dans le `storage` de
 * l'extension : celui-ci est propre à une machine et à un profil Chrome, donc
 * il ne protège de rien dès qu'on prospecte depuis un autre poste, ou après
 * avoir rechargé l'extension. La règle reste celle du cockpit — une réponse
 * par prospect et par jour civil Paris.
 */
async function autoRecord(
  prospectId: string,
  verdict: { replied: boolean; kind: string | null; excerpt?: string | null; confidence: string },
  accountId: string | null,
): Promise<AutoRecordResult> {
  if (!verdict.replied || !verdict.kind) return { recorded: false, reason: "pas-de-reponse" };
  if (verdict.confidence !== "haute") return { recorded: false, reason: "doute", kind: verdict.kind };

  const { data: already, error: dupErr } = await supabase
    .from("ig_replies")
    .select("id")
    .eq("prospect_id", prospectId)
    .gte("received_at", parisDayStart().toISOString())
    .limit(1);
  if (dupErr) return { recorded: false, reason: "erreur", error: dupErr.message };
  if (already && already.length > 0) return { recorded: false, reason: "deja-journalisee", kind: verdict.kind };

  const r = await logReply({
    prospect_id: prospectId,
    kind: verdict.kind,
    account_id: accountId,
    excerpt: verdict.excerpt ?? null,
  });
  if (!r.ok) return { recorded: false, reason: "erreur", error: r.error };
  return { recorded: true, kind: verdict.kind };
}
