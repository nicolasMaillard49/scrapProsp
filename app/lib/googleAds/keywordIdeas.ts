/**
 * Mots-clés "réels" via le Keyword Plan Idea Service de Google Ads.
 *
 * Pourquoi ce module : la génération historique (copy.ts) collait la VILLE dans
 * chaque mot-clé (`couvreur cormelles-le-royal`), ce qui — combiné au ciblage géo
 * de proximité déjà posé sur la campagne — donnait des mots-clés « Volume de
 * recherche faible / Non éligible » qui ne diffusent JAMAIS.
 *
 * Ici on demande à Google les vraies requêtes (avec leur volume mensuel) pour la
 * zone du lead, on filtre celles qui ont du volume, on RETIRE la ville (la géoloc
 * s'en charge), et on priorise l'intention commerciale.
 *
 * Cœur PUR (selectKeywords / seedKeywordsFor) = testé. La glue API (resolve* /
 * fetch* / bestKeywordsForLead) est de l'I/O fine, vérifiée au smoke-test runtime
 * comme le reste du module (cf. create.ts).
 */
import { enums, type Customer } from "google-ads-api";
import type { Keyword, MatchType } from "./copy";

/** Une idée de mot-clé renvoyée par Google : le texte + son volume mensuel moyen. */
export interface KeywordIdea {
  text: string;
  avgMonthlySearches: number;
}

export interface SelectOpts {
  /** Ville du lead : sert UNIQUEMENT à exclure les mots-clés qui la contiennent. */
  ville: string;
  /** Volume mensuel minimum pour qu'un mot-clé soit jugé diffusable (défaut 10). */
  minVolume?: number;
  /** Nombre max de mots-clés uniques retenus (défaut 8). */
  limit?: number;
}

const DEFAULT_MIN_VOLUME = 10;
const DEFAULT_LIMIT = 8;
const LANGUAGE_FR = "languageConstants/1002";
/** France entière — filet de sécurité quand la zone locale ne renvoie aucune donnée. */
const FRANCE_GEO = "geoTargetConstants/2250";

/** Minuscule + sans accents + ponctuation→espaces (pour comparer ville/texte). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Marqueurs d'intention commerciale (texte déjà normalisé sans accents). */
const INTENT_RX =
  /\b(devis|prix|tarif|tarifs|cout|urgence|depannage|reparation|remplacement|installation|pose|renovation|refection|pas cher)\b/;

function hasCommercialIntent(textNorm: string): boolean {
  return INTENT_RX.test(textNorm);
}

/**
 * Filtre + classe les idées Google en mots-clés diffusables.
 * - exclut tout mot-clé contenant la ville (la géoloc localise déjà)
 * - exclut le volume sous le seuil (les « Volume de recherche faible »)
 * - priorise l'intention commerciale, puis le volume
 * - décline chaque mot-clé retenu en PHRASE + EXACT
 */
export function selectKeywords(ideas: KeywordIdea[], opts: SelectOpts): Keyword[] {
  const minVolume = opts.minVolume ?? DEFAULT_MIN_VOLUME;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const villeNorm = norm(opts.ville);

  const seen = new Set<string>();
  const kept: { text: string; vol: number; intent: boolean }[] = [];

  for (const it of ideas) {
    const text = (it.text || "").trim().replace(/\s+/g, " ");
    if (text.length <= 3) continue;
    const tn = norm(text);
    if (!tn || seen.has(tn)) continue;
    if (villeNorm && tn.includes(villeNorm)) continue; // ville dans le mot-clé → exclu
    if (it.avgMonthlySearches < minVolume) continue;
    seen.add(tn);
    kept.push({ text, vol: it.avgMonthlySearches, intent: hasCommercialIntent(tn) });
  }

  // Intention d'abord (binaire), puis volume décroissant.
  kept.sort((a, b) => Number(b.intent) - Number(a.intent) || b.vol - a.vol);

  return kept.slice(0, limit).flatMap((k) => [
    { text: k.text, match: "PHRASE" as MatchType },
    { text: k.text, match: "EXACT" as MatchType },
  ]);
}

/** Graines envoyées à Google pour générer les idées — SANS ville. */
export function seedKeywordsFor(a: { metier: string; service: string }): string[] {
  const metier = a.metier.toLowerCase().trim();
  const service = a.service.toLowerCase().trim();
  const raw = [
    service,
    metier,
    `devis ${metier}`,
    `${metier} prix`,
    `${metier} pas cher`,
  ];
  return Array.from(new Set(raw.map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 2)));
}

// ── Glue API (I/O — smoke-test runtime) ─────────────────────────────────────

/**
 * Résout un nom de lieu FR en geo_target_constant (resource name). null si introuvable.
 * Ex. "Cormelles-le-Royal" → "geoTargetConstants/1006886" (commune).
 */
export async function resolveGeoTargetConstant(
  cust: Customer,
  locationName: string,
): Promise<string | null> {
  const name = (locationName || "").trim();
  if (!name) return null;
  try {
    const res = await cust.geoTargetConstants.suggestGeoTargetConstants({
      locale: "fr",
      country_code: "FR",
      location_names: { names: [name] },
    } as unknown as Parameters<Customer["geoTargetConstants"]["suggestGeoTargetConstants"]>[0]);
    const suggestions =
      (res as { geo_target_constant_suggestions?: Array<{ geo_target_constant?: { resource_name?: string } }> })
        .geo_target_constant_suggestions ?? [];
    return suggestions.map((s) => s.geo_target_constant?.resource_name).find(Boolean) ?? null;
  } catch (e) {
    console.warn("[google-ads][kw] resolveGeoTargetConstant échec:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Appelle generateKeywordIdeas pour une zone + des graines (+ URL optionnelle). */
export async function fetchKeywordIdeas(
  cust: Customer,
  args: { customerId: string; seeds: string[]; url?: string; geoTargetConstant: string },
): Promise<KeywordIdea[]> {
  const seed =
    args.url && args.seeds.length
      ? { keyword_and_url_seed: { keywords: args.seeds, url: args.url } }
      : args.url
        ? { url_seed: { url: args.url } }
        : { keyword_seed: { keywords: args.seeds } };

  const res = await cust.keywordPlanIdeas.generateKeywordIdeas({
    customer_id: args.customerId,
    language: LANGUAGE_FR,
    geo_target_constants: [args.geoTargetConstant],
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    include_adult_keywords: false,
    ...seed,
  } as unknown as Parameters<Customer["keywordPlanIdeas"]["generateKeywordIdeas"]>[0]);

  const rows =
    (res as { results?: Array<{ text?: string; keyword_idea_metrics?: { avg_monthly_searches?: number | string | null } }> })
      .results ?? [];
  return rows
    .map((r) => ({
      text: (r.text ?? "").trim(),
      avgMonthlySearches: Number(r.keyword_idea_metrics?.avg_monthly_searches ?? 0),
    }))
    .filter((k) => k.text.length > 0);
}

export interface BestKeywordsInput {
  metier: string;
  service: string;
  ville: string;
  /** Département du lead (ex. "Calvados") — essayé après la ville pour le volume. */
  department?: string | null;
  /** URL du site du lead — sert de graine de pertinence si fournie. */
  url?: string | null;
}

/**
 * Pipeline complet (option 2 — géo par ville/département du lead) :
 *   ville → (sinon) département → (sinon) France pour estimer le volume,
 *   puis sélection des meilleurs mots-clés SANS la ville.
 * Renvoie [] en cas d'échec/zone vide → l'appelant retombe sur le rule-based.
 */
export async function bestKeywordsForLead(
  cust: Customer,
  customerId: string,
  input: BestKeywordsInput,
): Promise<{ keywords: Keyword[]; geoUsed: string }> {
  const seeds = seedKeywordsFor({ metier: input.metier, service: input.service });
  const url = input.url?.trim() || undefined;

  // Échelle géo : la plus précise qui renvoie des mots-clés diffusables gagne.
  const localCandidates = [input.ville, input.department].filter(
    (x): x is string => !!x && x.trim().length > 0,
  );

  const tried: string[] = [];
  for (const loc of localCandidates) {
    const geo = await resolveGeoTargetConstant(cust, loc);
    if (!geo) continue;
    tried.push(geo);
    try {
      const ideas = await fetchKeywordIdeas(cust, { customerId, seeds, url, geoTargetConstant: geo });
      const keywords = selectKeywords(ideas, { ville: input.ville });
      if (keywords.length) return { keywords, geoUsed: `${loc} (${geo})` };
    } catch (e) {
      console.warn("[google-ads][kw] fetch échec sur", loc, ":", e instanceof Error ? e.message : e);
    }
  }

  // Filet : France entière.
  try {
    const ideas = await fetchKeywordIdeas(cust, { customerId, seeds, url, geoTargetConstant: FRANCE_GEO });
    return { keywords: selectKeywords(ideas, { ville: input.ville }), geoUsed: `France (${FRANCE_GEO})` };
  } catch (e) {
    console.warn("[google-ads][kw] fetch France échec:", e instanceof Error ? e.message : e);
    return { keywords: [], geoUsed: "aucune" };
  }
}
