// app/lib/igTrame.ts
// Construction PURE de la réponse « trame » servie à l'extension Chrome.
// Une seule source de vérité : instagramDmSequence — la même que la page
// /instagram (PipelineCard, TrameDM). Si une formulation change dans l'app,
// l'extension la sert à la requête suivante, sans republication.

import { instagramDmSequence, instagramDmSequenceSite, detectMetier, firstNameOf } from "./instagram";
import { nextStepFor, type Trame } from "./igPipeline";
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

export interface TramePayload {
  prospect: TrameProspect | null;
  steps: TrameStep[];
  nextStep: string | null;
  /** Trame servie — le panneau l'affiche, et elle décide des étapes rendues. */
  trame: Trame;
  /** Aperçu sur-mesure du prospect (/di/<code>), vide si prospect hors base. */
  demoLink: string;
}

/** Colonnes à sélectionner dans instagram_prospects pour ce payload. */
export const TRAME_COLUMNS =
  "id,username,full_name,bio,category,metier,ville,booking_platform,profession_ia,stage,status,followers,reply_count,next_followup_at,score_tier,first_reply_at,last_reply_at,last_dm_at";

export function buildTrame(
  prospect: TrameProspect | null,
  origin: string,
  trame: Trame = "standard",
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
  return {
    prospect,
    steps: sequence(
      {
        metier: metierEff,
        ville: prospect.ville ?? "",
        bookingPlatform: prospect.booking_platform,
        firstName: firstNameOf(prospect.full_name),
        professionIa: prospect.profession_ia,
      },
      link,
    ),
    nextStep: nextStepFor(prospect.stage, trame),
    trame,
    demoLink: link,
  };
}
