import { NextRequest, NextResponse } from "next/server";
import { igHealth } from "@/app/lib/igHealth";
import { sendTelegram } from "@/app/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/health/ig — le canari de la chaîne de prospection.
 *
 * Appelé par `vps/ig-refill.mjs` AVANT de lancer sa boucle : si l'IA ne rend
 * plus de verdict, chaque passe suivante brûlerait du quota de scraping pour
 * fabriquer du stock que personne ne qualifiera (c'est très exactement la
 * journée du 02/08 : 12 passes, 831 s, 0 verdict, sélection vide).
 *
 * Il PAIE un vrai appel au modèle sur un lot synthétique — c'est ce qui le rend
 * honnête, et c'est le seul test qui aurait attrapé le 404 du modèle. Rien n'est
 * écrit en base : le lot témoin ne passe jamais par `qualifyRun`.
 *
 * Auth : x-cron-secret == CRON_SECRET, ou Authorization: Bearer (cron Vercel).
 * Paramètre : ?notify=1 — poste sur Telegram si la chaîne est cassée.
 * Codes : 200 si tout va bien, 503 si un poste est cassé (lisible par un
 * `curl -f` ou n'importe quel superviseur, sans parser le JSON).
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized =
    !!secret &&
    (req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`);
  if (!authorized) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const notify = req.nextUrl.searchParams.get("notify") === "1";
  const report = await igHealth();

  // On ne notifie QUE ce qui mérite un réveil : une chaîne saine ne dit rien.
  if (notify && (!report.ok || report.alerte)) {
    const titre = report.ok ? "⚠️ <b>Chaîne IG — à surveiller</b>" : "❌ <b>Chaîne IG CASSÉE</b>";
    await sendTelegram(
      `${titre}\n` +
        report.checks
          .filter((c) => !c.ok || c.alerte)
          .map((c) => `• <b>${c.poste}</b> — ${c.detail}`)
          .join("\n"),
    );
  }

  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
