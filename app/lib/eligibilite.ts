import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

/** Base publique de l'app (liens dans SMS / emails). */
export function appBase(): string {
  // 1. Override explicite (ton futur nom de domaine).
  const explicit = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.NEXT_PUBLIC_DEMO_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // 2. Sur Vercel : domaine de prod fourni automatiquement (aucune config requise).
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  // 3. Dev local.
  return "http://localhost:3000";
}

/** Token court et URL-safe pour le lien du formulaire. */
export function makeToken(): string {
  // 12 caractères base36 (assez pour un usage test, pas de collision pratique).
  const a = Math.random().toString(36).slice(2, 8);
  const b = Math.random().toString(36).slice(2, 8);
  return (a + b).slice(0, 12);
}

// --- Config quiz (calquée sur Lokads) ---------------------------------------

export const EMPLOYEES = [
  { value: "solo", label: "Je travaille seul", hint: "Solo" },
  { value: "2_5", label: "2 à 5", hint: "Petite équipe" },
  { value: "6_15", label: "6 à 15", hint: "Équipe" },
  { value: "gt_15", label: "Plus de 15", hint: "Structure" },
] as const;

export const CA_RANGES = [
  { value: "lt_5k", label: "Moins de 5 000 € /mois" },
  { value: "5k_15k", label: "5 000 – 15 000 € /mois" },
  { value: "15k_50k", label: "15 000 – 50 000 € /mois" },
  { value: "gt_50k", label: "Plus de 50 000 € /mois" },
] as const;

export const AD_BUDGETS = [
  { value: "lt_500", label: "Moins de 500 € /mois", hint: "Petit" },
  { value: "500_1000", label: "500 – 1 000 € /mois", hint: "Standard" },
  { value: "1000_3000", label: "1 000 – 3 000 € /mois", hint: "Ambitieux" },
  { value: "gt_3000", label: "Plus de 3 000 € /mois", hint: "Agressif" },
] as const;

export const GOALS = [
  { value: "plus_30", label: "+30 % de CA", hint: "Confortable" },
  { value: "plus_50", label: "+50 % de CA", hint: "Ambitieux" },
  { value: "plus_100", label: "Doubler mon CA", hint: "Très ambitieux" },
  { value: "double", label: "Changer de dimension", hint: "Maximal" },
] as const;

// --- Scoring (priorité de rappel) -------------------------------------------

const W_CA: Record<string, number> = { lt_5k: 1, "5k_15k": 2, "15k_50k": 3, gt_50k: 4 };
const W_BUD: Record<string, number> = { lt_500: 1, "500_1000": 2, "1000_3000": 3, gt_3000: 4 };
const W_GOAL: Record<string, number> = { plus_30: 1, plus_50: 2, plus_100: 3, double: 4 };

export function computeScore(a: {
  ca_range?: string | null;
  ad_budget_range?: string | null;
  goal_range?: string | null;
}): number {
  return (W_CA[a.ca_range ?? ""] ?? 0) + (W_BUD[a.ad_budget_range ?? ""] ?? 0) + (W_GOAL[a.goal_range ?? ""] ?? 0);
}

// --- Géocodage (BAN — api-adresse.data.gouv.fr, gratuit, sans quota) ---------

export async function geocodeVille(ville: string): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(ville)}&type=municipality&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "scrapProsp-eligibilite" } });
    const data = await res.json();
    const f = data?.features?.[0];
    if (!f) return null;
    return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: f.properties.label };
  } catch {
    return null;
  }
}

// --- Génération de l'analyse (page rapport) ---------------------------------

export interface Analysis {
  service_cible: string;
  service_reason: string;
  budget_daily: number;
  budget_monthly: number;
  calls_per_month: number;
  revenue_month: number;
}

const BUDGET_DAILY: Record<string, number> = { lt_500: 12, "500_1000": 25, "1000_3000": 65, gt_3000: 110 };

/** Estimations déterministes à partir des réponses (fallback + base de calcul). */
export function estimate(a: { metier?: string; ad_budget_range?: string }): Omit<Analysis, "service_cible" | "service_reason"> {
  const daily = BUDGET_DAILY[a.ad_budget_range ?? ""] ?? 12;
  const monthly = daily * 30;
  // ~3 demandes / 40 € de budget, panier moyen ~70 € de CA additionnel par demande (hypothèse test).
  const calls = Math.round((monthly / 40) * 3);
  const revenue = calls * 70;
  return { budget_daily: daily, budget_monthly: monthly, calls_per_month: calls, revenue_month: revenue };
}

/** Choisit un service prioritaire + justification via Claude (fallback rule-based). */
export async function generateAnalysis(a: {
  metier?: string;
  ville?: string;
  radius_km?: number;
  ad_budget_range?: string;
}): Promise<Analysis> {
  const base = estimate(a);
  const fallback: Analysis = {
    service_cible: a.metier || "Votre service principal",
    service_reason: "Service le plus demandé sur Google dans votre zone en ce moment.",
    ...base,
  };

  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content:
            `Tu es expert Google Ads pour artisans locaux en France. ` +
            `Métier: "${a.metier}". Zone: "${a.ville}" + ${a.radius_km ?? 10} km. ` +
            `Choisis LE service unique le plus rentable à pousser en Google Ads pour ce métier ` +
            `(le plus recherché et à forte intention commerciale, en tenant compte de la saison actuelle), ` +
            `et explique en 1 phrase courte pourquoi. ` +
            `Réponds STRICTEMENT en JSON: {"service":"...","reason":"..."}`,
        },
      ],
    });
    const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (parsed.service) {
        return { ...fallback, service_cible: parsed.service, service_reason: parsed.reason || fallback.service_reason };
      }
    }
  } catch {
    /* fallback */
  }
  return fallback;
}

// --- Templates email --------------------------------------------------------

const euro = (n: number) => n.toLocaleString("fr-FR");

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Coquille d'email professionnelle, compatible clients mail (tables + styles
 * inline, largeur 600, police système, bouton « bulletproof »). Accent NMF.
 */
function emailShell(opts: {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  rows: { label: string; value: string }[];
  ctaLabel: string;
  ctaUrl: string;
  footnote?: string;
}): string {
  const ACCENT = "#7B4FE0";
  const ACCENT_DARK = "#5B34C0";
  const INK = "#0f172a";
  const MUTED = "#667085";
  const BORDER = "#eceef2";
  const phone = process.env.NEXT_PUBLIC_NMF_PHONE || "";

  const rows = opts.rows
    .map(
      (r, i) => `
            <tr>
              <td style="padding:13px 0;${i ? `border-top:1px solid ${BORDER};` : ""}color:${MUTED};font-size:14px;font-family:Helvetica,Arial,sans-serif">${r.label}</td>
              <td align="right" style="padding:13px 0;${i ? `border-top:1px solid ${BORDER};` : ""}color:${INK};font-size:14px;font-weight:600;font-family:Helvetica,Arial,sans-serif">${r.value}</td>
            </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"></head>
<body style="margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden">
        <tr><td style="height:4px;background:${ACCENT};line-height:4px;font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:26px 36px 0">
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.14em;color:${ACCENT}">NMF&nbsp;AGENCE</span>
        </td></tr>
        <tr><td style="padding:22px 36px 0">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:.12em;color:${MUTED};text-transform:uppercase">${esc(opts.eyebrow)}</div>
          <h1 style="margin:8px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:24px;line-height:1.25;color:${INK};font-weight:700">${opts.title}</h1>
        </td></tr>
        <tr><td style="padding:16px 36px 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#475467">${opts.intro}</td></tr>
        <tr><td style="padding:22px 36px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9ff;border:1px solid #ece8fb;border-radius:12px">
            <tr><td style="padding:6px 18px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:26px 36px 0">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:10px;background:${ACCENT}">
              <a href="${opts.ctaUrl}" style="display:inline-block;padding:14px 30px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;border:1px solid ${ACCENT_DARK}">${opts.ctaLabel}</a>
            </td>
          </tr></table>
        </td></tr>
        ${opts.footnote ? `<tr><td style="padding:20px 36px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${MUTED}">${opts.footnote}</td></tr>` : ""}
        <tr><td style="padding:28px 36px 30px">
          <div style="border-top:1px solid ${BORDER};padding-top:18px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#98a2b3">
            <strong style="color:#667085">NMF Agence</strong> — sites web &amp; acquisition pour artisans.${phone ? ` ${esc(phone)}.` : ""}<br>
            Vous recevez cet email suite à votre demande d'analyse Google Ads.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function confirmationEmailHtml(lead: {
  first_name?: string | null;
  metier?: string | null;
  ville?: string | null;
  service_cible?: string | null;
  budget_daily?: number | null;
  calls_per_month?: number | null;
  id: string;
}): { subject: string; html: string } {
  const reportUrl = `${appBase()}/eligibilite/rapport/${lead.id}`;
  const subject = "Votre analyse Google Ads est prête";
  const html = emailShell({
    preheader: `Votre analyse personnalisée pour ${lead.metier || "votre activité"} à ${lead.ville || "votre zone"}.`,
    eyebrow: "Votre analyse",
    title: `${lead.first_name ? `${esc(lead.first_name)}, votre` : "Votre"} analyse est prête.`,
    intro:
      `Nous avons étudié votre activité de <strong style="color:#0f172a">${esc(lead.metier || "")}</strong> ` +
      `sur <strong style="color:#0f172a">${esc(lead.ville || "")}</strong> et identifié le service le plus rentable à mettre en avant.`,
    rows: [
      { label: "Service ciblé", value: esc(lead.service_cible || "—") },
      { label: "Budget Google conseillé", value: `${lead.budget_daily ?? "—"} €/jour` },
      { label: "Demandes estimées", value: `~${lead.calls_per_month ?? "—"} / mois` },
    ],
    ctaLabel: "Voir mon analyse",
    ctaUrl: reportUrl,
    footnote: `Estimation à partir de performances moyennes — ce n'est pas une garantie. Lien direct : <a href="${reportUrl}" style="color:#7B4FE0">${reportUrl}</a>`,
  });
  return { subject, html };
}

export function launchEmailHtml(lead: {
  first_name?: string | null;
  service_cible?: string | null;
  ville?: string | null;
  budget_daily?: number | null;
  calls_per_month?: number | null;
  id: string;
}): { subject: string; html: string } {
  const reportUrl = `${appBase()}/eligibilite/rapport/${lead.id}`;
  const subject = "Votre campagne est prête — dernière étape";
  const html = emailShell({
    preheader: "Votre compte est configuré : il ne reste qu'à valider pour lancer.",
    eyebrow: "Activation",
    title: `${lead.first_name ? `${esc(lead.first_name)}, votre` : "Votre"} campagne est prête.`,
    intro:
      "Votre compte publicitaire et votre campagne sont configurés. " +
      "Il ne reste qu'une étape — valider l'activation — pour commencer à recevoir vos premiers appels.",
    rows: [
      { label: "Service ciblé", value: esc(lead.service_cible || "—") },
      { label: "Zone", value: esc(lead.ville || "—") },
      { label: "Budget", value: `${lead.budget_daily ?? "—"} €/jour · ~${lead.calls_per_month ?? "—"} demandes/mois` },
    ],
    ctaLabel: "Activer ma campagne",
    ctaUrl: reportUrl,
    footnote: "La 1ʳᵉ semaine de gestion est offerte (vous financez uniquement votre budget Google). Aucun engagement.",
  });
  return { subject, html };
}
