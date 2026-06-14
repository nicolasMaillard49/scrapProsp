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
  const subject = "Votre analyse personnalisée est prête 🎉";
  const html = `
  <div style="background:#0b0b0f;color:#e7e7ea;font-family:Arial,sans-serif;padding:32px">
    <div style="max-width:560px;margin:0 auto">
      <p style="color:#9ca3af;letter-spacing:.2em;font-size:12px">VOTRE ANALYSE</p>
      <h1 style="font-size:22px;margin:8px 0 16px">Tout a bien été pris en compte ✅</h1>
      <p>Bonjour ${lead.first_name || ""},</p>
      <p>Votre demande a été enregistrée. On a préparé votre analyse personnalisée pour votre activité de
         <b>${lead.metier || ""}</b> sur <b>${lead.ville || ""}</b>.</p>
      <div style="border:1px solid #2a2a35;border-radius:12px;padding:16px;margin:18px 0">
        <p style="margin:4px 0">Service ciblé : <b>${lead.service_cible || "—"}</b></p>
        <p style="margin:4px 0">Budget pub Google : <b>${lead.budget_daily ?? "—"} €/jour</b></p>
        <p style="margin:4px 0">Demandes estimées : <b>~${lead.calls_per_month ?? "—"} / mois</b></p>
      </div>
      <a href="${reportUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;
         padding:14px 22px;border-radius:10px;font-weight:bold">Voir mon analyse →</a>
      <p style="color:#6b7280;font-size:12px;margin-top:18px">Si le lien ne fonctionne pas : ${reportUrl}</p>
    </div>
  </div>`;
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
  const subject = "Votre compte est prêt, finalisons le lancement 🚀";
  const html = `
  <div style="background:#0b0b0f;color:#e7e7ea;font-family:Arial,sans-serif;padding:32px">
    <div style="max-width:560px;margin:0 auto">
      <p style="color:#9ca3af;letter-spacing:.2em;font-size:12px">LANCEMENT</p>
      <h1 style="font-size:22px;margin:8px 0 16px">Votre compte est prêt 🎉</h1>
      <p>Bonjour ${lead.first_name || ""},</p>
      <p>Votre campagne est configurée. Il ne reste qu'une étape pour recevoir vos premiers appels.</p>
      <div style="border:1px solid #2a2a35;border-radius:12px;padding:16px;margin:18px 0">
        <p style="margin:4px 0">Service ciblé : <b>${lead.service_cible || "—"}</b></p>
        <p style="margin:4px 0">Zone : <b>${lead.ville || "—"}</b></p>
        <p style="margin:4px 0">Budget : <b>${lead.budget_daily ?? "—"} €/jour</b> · ~${lead.calls_per_month ?? "—"} demandes/mois</p>
      </div>
      <a href="${reportUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;
         padding:14px 22px;border-radius:10px;font-weight:bold">Reprendre mon activation →</a>
      <p style="color:#6b7280;font-size:12px;margin-top:18px">La 1ʳᵉ semaine de gestion est offerte. Aucune carte demandée de notre côté.</p>
    </div>
  </div>`;
  return { subject, html };
}
