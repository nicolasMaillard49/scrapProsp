// app/lib/igTrame.ts
// Construction PURE de la réponse « trame » servie à l'extension Chrome.
// Une seule source de vérité : instagramDmSequence — la même que la page
// /instagram (PipelineCard, TrameDM). Si une formulation change dans l'app,
// l'extension la sert à la requête suivante, sans republication.

import { instagramDmSequence, instagramDmSequenceSite, detectMetier, firstNameOf, accrocheVars } from "./instagram";
import { nextStepFor, type Trame } from "./igPipeline";
import { mapsHeadline, type MapsFacts } from "./igMaps";
import { fillVariant } from "./igVariants";
import { shortCode } from "./links";

export interface TrameProspect {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  category: string | null;
  metier: string | null;
  ville: string | null;
  booking_platform: string | null;
  profession_ia: string | null;
  stage: string | null;
  status: string;
  followers: number | null;
  reply_count: number | null;
  next_followup_at: string | null;
  score_tier: string | null;
  /** Journal des réponses ENTRANTES (migration 018) — alimente l'état du panneau. */
  first_reply_at: string | null;
  last_reply_at: string | null;
  last_dm_at: string | null;
}

export interface TrameStep {
  step: string;
  title: string;
  text: string;
}

/** Ce que le prospect ignore sur sa propre visibilité — cf. igMaps. */
export interface TrameFact {
  /** La phrase, prête à coller. */
  text: string;
  /** Classement sur « métier ville » ; null = absent des résultats. */
  rank: number | null;
  /** Concurrents qui paient des Google Ads sur la requête. */
  adsCount: number | null;
  /** Date du scrape — un fait de six mois ne se colle pas les yeux fermés. */
  checkedAt: string;
}

export interface TramePayload {
  prospect: TrameProspect | null;
  steps: TrameStep[];
  nextStep: string | null;
  /** Trame servie — le panneau l'affiche, et elle décide des étapes rendues. */
  trame: Trame;
  /** Aperçu sur-mesure du prospect (/di/<code>), vide si prospect hors base. */
  demoLink: string;
  /**
   * Le fait qu'il ne connaît pas sur lui-même, quand un rapport concurrentiel
   * a tourné. `null` sinon — on n'invente jamais un classement.
   */
  fact: TrameFact | null;
  /**
   * Variante d'accroche tirée pour ce prospect (bandit, cf. igVariants).
   * `null` = la trame écrite. Le panneau la renvoie à la journalisation :
   * sans elle, une réponse arrivée trois jours plus tard ne pourrait être
   * créditée à aucune formulation.
   */
  variantId: string | null;
}

/** Colonnes à sélectionner dans instagram_prospects pour ce payload. */
export const TRAME_COLUMNS =
  "id,username,full_name,bio,category,metier,ville,booking_platform,profession_ia,stage,status,followers,reply_count,next_followup_at,score_tier,first_reply_at,last_reply_at,last_dm_at";

export function buildTrame(
  prospect: TrameProspect | null,
  origin: string,
  trame: Trame = "standard",
  facts: MapsFacts | null = null,
  variant: { id: string; text: string } | null = null,
): TramePayload {
  const sequence = trame === "site" ? instagramDmSequenceSite : instagramDmSequence;
  if (!prospect) {
    // Hors base : aucun aperçu ne peut exister (il est calculé sur l'UUID du
    // prospect). La trame site reste consultable — l'étape S3 le dit alors
    // elle-même plutôt que d'afficher un lien mort.
    return {
      prospect: null,
      steps: sequence({ metier: "", ville: "" }, ""),
      nextStep: trame === "site" ? "S1" : "M1",
      trame,
      demoLink: "",
      fact: null,
      variantId: null,
    };
  }
  // Même cascade que PipelineCard (app/instagram/page.tsx) : la profession IA
  // précise prime, puis la détection catégorie+bio, puis le métier stocké.
  const metierEff =
    detectMetier(prospect.profession_ia, null) ||
    detectMetier(prospect.category, `${prospect.username} ${prospect.bio ?? ""}`) ||
    prospect.metier ||
    "";
  const link = origin ? `${origin.replace(/\/$/, "")}/di/${shortCode(prospect.id)}` : "";
  const dmInput = {
    metier: metierEff,
    ville: prospect.ville ?? "",
    bookingPlatform: prospect.booking_platform,
    firstName: firstNameOf(prospect.full_name),
    professionIa: prospect.profession_ia,
  };
  const steps = sequence(dmInput, link);

  // La variante remplace le TEXTE de l'accroche, jamais son identifiant : c'est
  // toujours M1 (ou S1) qui part, donc le stade, la dedup et les KPI ne bougent
  // pas d'un pouce. Une variante qui changerait l'étape casserait tout le reste.
  //
  // Ses gabarits sont remplis ici : une variante est un texte FIXE en base, et
  // sans cette étape elle enverrait le même message à tout le monde — en
  // perdant précisément ce qui fait marcher l'accroche standard. Si un gabarit
  // n'a pas de valeur (métier inconnu, pas de prénom fiable), on retombe sur
  // l'accroche standard ET on oublie la variante : la créditer d'un envoi qui
  // n'a pas eu lieu fausserait la mesure qu'elle sert justement à produire.
  const accroche = steps.find((s) => /^[MS]1$/.test(s.step));
  let applied: string | null = null;
  if (variant && accroche) {
    const filled = fillVariant(variant.text, accrocheVars(dmInput));
    if (filled) {
      accroche.text = filled;
      applied = variant.id;
    }
  }

  return {
    prospect,
    steps,
    nextStep: nextStepFor(prospect.stage, trame),
    trame,
    demoLink: link,
    fact: facts
      ? {
          text: mapsHeadline(facts, metierEff, prospect.ville ?? ""),
          rank: facts.rank,
          adsCount: facts.adsCount,
          checkedAt: facts.checkedAt,
        }
      : null,
    variantId: applied,
  };
}
