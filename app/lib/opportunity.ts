import type { Prospect } from "./types";
import { ageYears, isRadie } from "./sirene";

/**
 * Score d'opportunité (0-100) = probabilité qu'un prospect achète un site.
 * Combine la data SIRENE + Google : visibilité en ligne, âge de la boîte,
 * âge du dirigeant (transmission), capacité à payer (effectif), sérieux (RGE).
 * Plus le score est haut, plus le prospect est "chaud" à appeler en priorité.
 *
 * Pondération (max) : visibilité 35 · âge entreprise 20 · dirigeant 20 ·
 * effectif 15 · RGE 10.
 */
export interface OpportunityResult {
  score: number;
  reasons: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// INSEE — points "capacité à payer" par tranche d'effectif salarié.
const EFFECTIF_PTS: Record<string, number> = {
  NN: 5, "00": 5, "01": 10, "02": 15, "03": 13, "11": 10,
  "12": 6, "21": 6, "22": 6, "31": 6, "32": 6, "41": 6, "42": 6, "51": 6, "52": 6, "53": 6,
};

export function opportunityScore(
  p: Prospect,
  nowYear: number = new Date().getFullYear(),
): OpportunityResult {
  // Radiée → aucune opportunité.
  if (isRadie(p)) return { score: 0, reasons: ["⛔ Entreprise radiée"] };

  const reasons: string[] = [];
  let score = 0;

  // A. Visibilité en ligne (0-35) — moins visible = plus à gagner pour nous.
  const reviews = p.reviews;
  if (reviews == null || reviews === 0) score += 15;
  else if (reviews < 10) { score += 25; reasons.push(`Quasi invisible (${reviews} avis)`); }
  else if (reviews < 30) score += 15;
  else if (reviews < 100) score += 7;
  else reasons.push(`Déjà très visible (${reviews} avis)`);

  const rating = p.rating;
  if (rating == null) score += 5;
  else if (rating < 3.5) { score += 10; reasons.push(`Note faible (${rating}★)`); }
  else if (rating < 4.5) score += 8;
  else if (rating < 4.8) score += 4;
  else score += 2;

  // B. Âge de l'entreprise (0-20) — jeune = en développement, investit.
  const age = ageYears(p);
  if (age == null) score += 8;
  else if (age < 2) { score += 20; reasons.push(`Jeune entreprise (${age} an${age > 1 ? "s" : ""})`); }
  else if (age < 5) { score += 16; reasons.push(`Entreprise récente (${age} ans)`); }
  else if (age < 10) score += 10;
  else if (age < 20) score += 6;
  else score += 3;

  // C. Âge du dirigeant / transmission (0-20).
  const birth = p.dirigeant_annee_naissance;
  if (birth == null) score += 10;
  else {
    const dAge = nowYear - birth;
    if (dAge < 35) score += 16;
    else if (dAge < 50) { score += 20; reasons.push(`Dirigeant ${dAge} ans (investit)`); }
    else if (dAge < 58) score += 12;
    else if (dAge < 65) { score += 5; reasons.push(`⚠ Dirigeant ${dAge} ans (transmission proche)`); }
    else { score += 1; reasons.push(`⚠ Dirigeant ${dAge} ans (retraite proche)`); }
  }

  // D. Capacité à payer / effectif (0-15).
  const eff = p.tranche_effectif;
  if (eff && eff in EFFECTIF_PTS) {
    score += EFFECTIF_PTS[eff];
    if (eff === "02" || eff === "03") reasons.push(`${p.effectif_label} (budget)`);
  } else score += 5;

  // E. Sérieux / RGE (0-10).
  if (p.est_rge === true) { score += 10; reasons.push("RGE — entreprise sérieuse"); }
  else score += 4;

  return { score: clamp(score), reasons: reasons.slice(0, 4) };
}

/** Badge thermique d'après le score d'opportunité. */
export function opportunityBadge(score: number): { color: string; bg: string; label: string } {
  if (score >= 70) return { color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Chaud" };
  if (score >= 45) return { color: "text-amber-400", bg: "bg-amber-500/15", label: "Tiède" };
  return { color: "text-neutral-400", bg: "bg-neutral-500/15", label: "Froid" };
}
