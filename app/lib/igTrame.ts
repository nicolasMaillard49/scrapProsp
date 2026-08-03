// app/lib/igTrame.ts
// Construction PURE de la réponse « trame » servie à l'extension Chrome.
// Une seule source de vérité : instagramDmSequence — la même que la page
// /instagram (PipelineCard, TrameDM). Si une formulation change dans l'app,
// l'extension la sert à la requête suivante, sans republication.

import { instagramDmSequence, detectMetier, firstNameOf } from "./instagram";
import { nextStepFor } from "./igPipeline";
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
}

/** Colonnes à sélectionner dans instagram_prospects pour ce payload. */
export const TRAME_COLUMNS =
  "id,username,full_name,bio,category,metier,ville,booking_platform,profession_ia,stage,status,followers,reply_count,next_followup_at,score_tier,first_reply_at,last_reply_at,last_dm_at";

export function buildTrame(prospect: TrameProspect | null, origin: string): TramePayload {
  if (!prospect) {
    return {
      prospect: null,
      steps: instagramDmSequence({ metier: "", ville: "" }, ""),
      nextStep: "M1",
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
    steps: instagramDmSequence(
      {
        metier: metierEff,
        ville: prospect.ville ?? "",
        bookingPlatform: prospect.booking_platform,
        firstName: firstNameOf(prospect.full_name),
        professionIa: prospect.profession_ia,
      },
      link,
    ),
    nextStep: nextStepFor(prospect.stage),
  };
}
