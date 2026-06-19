import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCampaignSystemPrompt, type ChatContext } from "./chatPrompt";
import type { CampaignReport } from "./report";

function report(over: Partial<CampaignReport> = {}): CampaignReport {
  const zero = {
    impressions: 0, clicks: 0, ctr: 0, avgCpcEur: 0, costEur: 0,
    conversions: 0, phoneCalls: 0, costPerConvEur: null, searchBudgetLostIs: null,
  };
  return {
    live: true,
    campaign: { id: "1", name: "Plombier Tours", status: "ENABLED", servingStatus: "SERVING", adApproval: "APPROVED", biddingStrategy: "TARGET_SPEND", startDate: "2026-06-12", endDate: "2026-06-19" },
    budget: { dailyEur: 14 },
    metrics30d: { ...zero, impressions: 2000, clicks: 80, costEur: 35, phoneCalls: 6 },
    metrics7d: { ...zero, impressions: 500, clicks: 20, costEur: 9, phoneCalls: 2 },
    topKeywords: [{ text: "débouchage canalisation", matchType: "PHRASE", qualityScore: 7, clicks: 30 }],
    warnings: [],
    ...over,
  };
}

const baseCtx = (r: CampaignReport): ChatContext => ({
  clientName: "Jean Plomberie", metier: "plombier", ville: "Tours", dailyBudgetDb: 14, report: r,
});

test("buildCampaignSystemPrompt: contient les KPIs clés et le contexte client", () => {
  const p = buildCampaignSystemPrompt(baseCtx(report()));
  assert.match(p, /Plombier Tours/);
  assert.match(p, /appel téléphonique/i);
  assert.match(p, /impressions : 2000/);
  assert.match(p, /appels téléphoniques : 6/);
  assert.match(p, /débouchage canalisation/);
  assert.match(p, /Budget\/jour : 14 €/);
  assert.match(p, /ne peux RIEN modifier/i);
});

test("buildCampaignSystemPrompt: live=false → signale la limite et utilise le budget DB", () => {
  const r = report({ live: false, budget: { dailyEur: null }, warnings: ["quota dépassé"] });
  const p = buildCampaignSystemPrompt({ ...baseCtx(r), dailyBudgetDb: 20 });
  assert.match(p, /indisponibles/i);
  assert.match(p, /quota dépassé/);
  assert.match(p, /Budget\/jour : 20 €/);
});

test("buildCampaignSystemPrompt: sans mots-clés → mention explicite", () => {
  const p = buildCampaignSystemPrompt(baseCtx(report({ topKeywords: [] })));
  assert.match(p, /aucun mot-clé/i);
});
