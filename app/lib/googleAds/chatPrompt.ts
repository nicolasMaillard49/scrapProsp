/**
 * Construit le system prompt du chatbot « questions sur la campagne ».
 * PURE (testable) : on injecte tout le snapshot (perf live + config) en français
 * dans le contexte. Claude répond aux questions de Nicolas, SANS rien modifier.
 */
import type { CampaignReport, Metrics } from "./report";

export interface ChatContext {
  clientName: string;
  metier: string | null;
  ville: string | null;
  dailyBudgetDb: number | null; // budget/jour connu en base (fallback si live indispo)
  report: CampaignReport;
}

function pct(ratio: number | null): string {
  if (ratio == null) return "n/c";
  return `${Math.round(ratio * 1000) / 10} %`;
}

function metricsBlock(label: string, m: Metrics): string {
  return [
    `${label} :`,
    `  - impressions : ${m.impressions}`,
    `  - clics : ${m.clicks} (CTR ${pct(m.ctr)})`,
    `  - CPC moyen : ${m.avgCpcEur} €`,
    `  - dépense : ${m.costEur} €`,
    `  - conversions : ${m.conversions}`,
    `  - appels téléphoniques : ${m.phoneCalls}`,
    `  - coût par conversion : ${m.costPerConvEur == null ? "n/c" : `${m.costPerConvEur} €`}`,
    `  - part d'impressions perdue (budget) : ${pct(m.searchBudgetLostIs)}`,
  ].join("\n");
}

export function buildCampaignSystemPrompt(ctx: ChatContext): string {
  const { report: r } = ctx;
  const dailyBudget = r.budget.dailyEur ?? ctx.dailyBudgetDb;

  const lines: string[] = [
    `Tu es un expert Google Ads pour artisans et petites entreprises locales en France.`,
    `Tu assistes Nicolas (agence NMF), qui gère la campagne d'un client. Réponds en français,`,
    `de façon concise, concrète et actionnable. Base-toi UNIQUEMENT sur les données ci-dessous.`,
    `Si une donnée manque ou est marquée « n/c », dis-le clairement plutôt que d'inventer.`,
    `Tu ne peux RIEN modifier dans la campagne : tu expliques, analyses et recommandes.`,
    ``,
    `Conversion suivie pour ce client = appel téléphonique depuis l'annonce (≥ 30 s).`,
    ``,
    `=== CAMPAGNE ===`,
    `Client : ${ctx.clientName}`,
    `Métier / ville : ${ctx.metier ?? "?"} — ${ctx.ville ?? "?"}`,
    `Nom campagne : ${r.campaign.name || "(inconnu)"}`,
    `Statut : ${r.campaign.status || "?"}`,
    `Diffusion (serving status) : ${r.campaign.servingStatus || "?"}`,
    `Approbation de l'annonce : ${r.campaign.adApproval ?? "n/c"}`,
    `Stratégie d'enchères : ${r.campaign.biddingStrategy || "?"}`,
    `Budget/jour : ${dailyBudget == null ? "n/c" : `${dailyBudget} €`}`,
    `Période de diffusion : ${r.campaign.startDate ?? "?"} → ${r.campaign.endDate ?? "(pas de fin)"}`,
    ``,
    metricsBlock("=== PERFORMANCE (30 derniers jours)", r.metrics30d),
    ``,
    metricsBlock("=== PERFORMANCE (7 derniers jours)", r.metrics7d),
    ``,
    `=== TOP MOTS-CLÉS (par clics, 30 j) ===`,
  ];

  if (r.topKeywords.length) {
    for (const k of r.topKeywords) {
      lines.push(`  - ${k.text} [${k.matchType}] · ${k.clicks} clics · Quality Score ${k.qualityScore ?? "n/c"}`);
    }
  } else {
    lines.push(`  (aucun mot-clé avec données sur la période)`);
  }

  if (!r.live) {
    lines.push(``, `⚠️ Les métriques live Google Ads sont indisponibles (${r.warnings.join(" ; ") || "raison inconnue"}).`);
    lines.push(`Les chiffres ci-dessus peuvent être à zéro ; signale cette limite si la question porte sur la performance.`);
  }

  return lines.join("\n");
}
