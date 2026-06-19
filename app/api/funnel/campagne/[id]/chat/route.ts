import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { getTrackedCampaign } from "@/app/lib/googleAds/persistence";
import { fetchCampaignReport, emptyReport } from "@/app/lib/googleAds/report";
import { buildCampaignSystemPrompt } from "@/app/lib/googleAds/chatPrompt";

/** Modèle du chat : sonnet par défaut (meilleur raisonnement sur les chiffres). */
const CHAT_MODEL = process.env.ANTHROPIC_CHAT_MODEL || "claude-sonnet-4-6";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * POST /api/funnel/campagne/[id]/chat  { messages: ChatMessage[] }
 * Reconstruit le snapshot de la campagne (perf live + config) côté serveur, l'injecte
 * en system prompt et streame la réponse de Claude. Lecture seule, aucune action.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseAdminConfigured) return json({ error: "Supabase non configuré" }, 503);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "Clé Anthropic absente : chatbot indisponible." }, 503);

  const { id } = await params;

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }
  const messages = (body.messages ?? []).filter(
    (m): m is ChatMessage => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );
  if (!messages.length) return json({ error: "Aucun message" }, 400);

  const camp = await getTrackedCampaign(id);
  if (!camp) return json({ error: "Campagne introuvable" }, 404);

  // Snapshot live (ne lève jamais : live:false si l'API échoue).
  const report = camp.customer_id
    ? await fetchCampaignReport(camp.customer_id, camp.campaign_id)
    : emptyReport(camp.campaign_id, ["Compte client inconnu : pas de données live."]);

  const system = buildCampaignSystemPrompt({
    clientName: camp.client_name,
    metier: camp.metier,
    ville: camp.ville,
    dailyBudgetDb: camp.daily_budget,
    report,
  });

  const client = new Anthropic();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const ev = await client.messages.create({
          model: CHAT_MODEL,
          max_tokens: 1024,
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        });
        for await (const chunk of ev) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n⚠️ Erreur Claude : ${e instanceof Error ? e.message : String(e)}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
