/**
 * Génération du contenu d'annonce via Claude (mêmes conventions que eligibilite.ts)
 * avec fallback rule-based : le dry-run fonctionne même sans clé Anthropic.
 *
 * Respecte les contraintes RSA (cf. skill → annonces-rsa.md) :
 *  - titres ≤ 30 caractères, descriptions ≤ 90 caractères
 *  - 15 titres / 4 descriptions visés
 *  - mots-clés en match phrase + exact (jamais broad sans négatifs solides)
 */
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

export type MatchType = "PHRASE" | "EXACT";
export interface Keyword {
  text: string;
  match: MatchType;
}
export interface AdCopy {
  headlines: string[]; // ≤ 30 car.
  descriptions: string[]; // ≤ 90 car.
  path1: string; // chemin d'URL affiché (≤ 15 car.)
  path2: string;
}

/** Tronque à n caractères max, en cassant sur un mot (évite "...Tou"). */
function clamp(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  // Coupe au dernier espace si on ne perd pas trop (sinon coupe brute).
  return (lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.!-]+$/, "").trim();
}
const dedupe = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

/**
 * Mots-clés rule-based à partir du service ciblé — SANS ville.
 * La ville n'est volontairement PAS dans le mot-clé : le ciblage géographique de
 * proximité (cf. create.ts) localise déjà la diffusion. Mettre la ville dedans
 * combinait deux restrictions géo et donnait des mots-clés « Volume de recherche
 * faible / Non éligible » qui ne diffusaient jamais.
 */
export function fallbackKeywords(service: string): Keyword[] {
  const s = service.toLowerCase().trim();
  const bases = [
    s,
    `devis ${s}`,
    `${s} pas cher`,
    `${s} urgence`,
    `${s} rapide`,
    `${s} prix`,
  ].filter((x) => x.replace(/\s+/g, " ").trim().length > 3);

  const uniq = dedupe(bases);
  // Chaque base en phrase + exact.
  return uniq.flatMap((text) => [
    { text, match: "PHRASE" as MatchType },
    { text, match: "EXACT" as MatchType },
  ]);
}

/** RSA rule-based (toujours valide, sert de fallback et de garantie de complétude). */
export function fallbackAdCopy(service: string, ville: string, metier: string): AdCopy {
  const S = service.replace(/\b\w/g, (c) => c.toUpperCase());
  const V = ville.replace(/\b\w/g, (c) => c.toUpperCase());
  const headlines = dedupe([
    clamp(`${S} ${V}`, 30),
    clamp(`${S} à ${V}`, 30),
    "Devis Gratuit Sous 24h",
    "Intervention Rapide 7j/7",
    "Artisan Local de Confiance",
    "Appelez Maintenant",
    "Tarifs Clairs et Honnêtes",
    "Disponible Aujourd'hui",
    clamp(`Spécialiste ${S}`, 30),
    "Travail Soigné et Garanti",
    "+10 Ans d'Expérience",
    clamp(`Intervient sur ${V}`, 30),
    "Sans Engagement",
    "Devis Par Téléphone",
    "Réponse en 1h",
  ]).slice(0, 15);

  const descriptions = dedupe([
    clamp(`${S} à ${V} : intervention rapide, devis gratuit. Appelez un artisan ${metier} de confiance.`, 90),
    clamp(`Besoin d'un ${metier} fiable sur ${V} ? Travail soigné, tarifs transparents. Devis gratuit.`, 90),
    clamp(`Urgence ${S.toLowerCase()} ? On intervient vite sur ${V} et alentours. Disponible 7j/7.`, 90),
    clamp(`Artisan ${metier} local. Devis sans engagement, garantie sur nos interventions. Appelez-nous.`, 90),
  ]).slice(0, 4);

  return { headlines, descriptions, path1: clamp(metier, 15), path2: clamp(ville, 15) };
}

/** Demande à Claude des mots-clés + RSA ; retombe sur le rule-based en cas d'échec. */
export async function generateAdContent(a: {
  metier: string;
  ville: string;
  service: string;
}): Promise<{ keywords: Keyword[]; ad: AdCopy; source: "claude" | "fallback" }> {
  const fb = {
    keywords: fallbackKeywords(a.service),
    ad: fallbackAdCopy(a.service, a.ville, a.metier),
    source: "fallback" as const,
  };
  if (!process.env.ANTHROPIC_API_KEY) return fb;

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content:
            `Tu es expert Google Ads pour artisans locaux en France. ` +
            `Métier: "${a.metier}". Ville: "${a.ville}". Service à pousser: "${a.service}". ` +
            `Génère une campagne Search. Contraintes STRICTES : titres ≤ 30 caractères, ` +
            `descriptions ≤ 90 caractères, pas de MAJUSCULES entières, pas de "!!!", chiffres bienvenus. ` +
            `Donne 8 expressions de mots-clés à forte intention commerciale SANS le nom de la ville ` +
            `(le ciblage géographique localise déjà la diffusion ; mettre la ville dans le mot-clé ` +
            `le rend "Volume de recherche faible" et il ne diffuse jamais). La ville reste autorisée ` +
            `dans les titres et descriptions. Donne aussi 15 titres et 4 descriptions. ` +
            `Réponds STRICTEMENT en JSON: {"keywords":["..."],"headlines":["..."],"descriptions":["..."]}`,
        },
      ],
    });
    const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return fb;
    const p = JSON.parse(m[0]) as { keywords?: string[]; headlines?: string[]; descriptions?: string[] };

    const kwTexts = dedupe((p.keywords ?? []).map((k) => clamp(k, 80)));
    const keywords: Keyword[] = kwTexts.length
      ? kwTexts.flatMap((text) => [
          { text, match: "PHRASE" as MatchType },
          { text, match: "EXACT" as MatchType },
        ])
      : fb.keywords;

    const headlines = dedupe((p.headlines ?? []).map((h) => clamp(h, 30))).slice(0, 15);
    const descriptions = dedupe((p.descriptions ?? []).map((d) => clamp(d, 90))).slice(0, 4);

    // Garantie de complétude : on complète avec le fallback si Claude est avare.
    const ad: AdCopy =
      headlines.length >= 5 && descriptions.length >= 2
        ? {
            headlines: dedupe([...headlines, ...fb.ad.headlines]).slice(0, 15),
            descriptions: dedupe([...descriptions, ...fb.ad.descriptions]).slice(0, 4),
            path1: fb.ad.path1,
            path2: fb.ad.path2,
          }
        : fb.ad;

    return { keywords, ad, source: "claude" };
  } catch {
    return fb;
  }
}
