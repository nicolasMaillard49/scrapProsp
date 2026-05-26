import type { CompetitorResult } from "./types";

/** Compute a GBP score (0-100) for a prospect without a website */
export function computeGbpScore(
  rating: number | null,
  reviews: number | null,
): number {
  const ratingScore = rating != null ? (rating / 5) * 40 : 0;
  const reviewsScore =
    reviews != null
      ? Math.min(Math.log10(reviews + 1) / Math.log10(500), 1) * 40
      : 0;
  // No website score (prospects don't have one)
  return Math.round(ratingScore + reviewsScore);
}

/** Badge color based on GBP strength (= lead quality) */
export function gbpBadge(rating: number | null, reviews: number | null): {
  color: string;
  bg: string;
  label: string;
} {
  const score = computeGbpScore(rating, reviews);
  if (score >= 55)
    return { color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Fort" };
  if (score >= 35)
    return { color: "text-amber-400", bg: "bg-amber-500/15", label: "Moyen" };
  return { color: "text-rose-400", bg: "bg-rose-500/15", label: "Faible" };
}

/** Generate contextual sales arguments from competitor analysis */
export function generateSalesArgs(
  prospectName: string,
  prospectScore: number,
  competitors: CompetitorResult[],
  adsBudget: number | null,
): string[] {
  const args: string[] = [];

  const withSite = competitors.filter((c) => c.website);
  const withoutSite = competitors.filter((c) => !c.website);

  // Argument: competitors have websites
  if (withSite.length > 0) {
    const ratio = withSite.length;
    const total = competitors.length;
    args.push(
      `${ratio} de vos ${total} concurrents directs ont un site web — vous êtes invisible en ligne.`,
    );
  }

  // Argument: prospect ranking
  const sorted = [...competitors].sort((a, b) => b.gbp_score - a.gbp_score);
  const rank =
    sorted.findIndex(
      (c) => c.name.toLowerCase() === prospectName.toLowerCase(),
    ) + 1;

  if (rank > 0) {
    if (rank <= 3) {
      args.push(
        `Vous êtes déjà #${rank} localement — un site web vous propulserait en tête.`,
      );
    } else {
      const top = sorted[0];
      args.push(
        `Vous êtes #${rank} sur ${sorted.length} — ${top.name} vous devance avec un score de ${top.gbp_score}/100.`,
      );
    }
  }

  // Argument: reviews advantage or gap
  const prospectInList = competitors.find(
    (c) => c.name.toLowerCase() === prospectName.toLowerCase(),
  );
  const prospectReviews = prospectInList?.reviews ?? 0;
  const avgReviews =
    competitors.reduce((s, c) => s + (c.reviews ?? 0), 0) / competitors.length;

  if (prospectReviews > avgReviews * 1.3) {
    args.push(
      `Avec ${prospectReviews} avis (moyenne locale: ${Math.round(avgReviews)}), vos clients vous font déjà confiance — capitalisez là-dessus.`,
    );
  } else if (prospectReviews < avgReviews * 0.7 && avgReviews > 10) {
    args.push(
      `Vos concurrents ont en moyenne ${Math.round(avgReviews)} avis contre ${prospectReviews} pour vous — il faut rattraper ce retard.`,
    );
  }

  // Argument: ads budget
  if (adsBudget && adsBudget > 200) {
    args.push(
      `Le budget Google Ads moyen dans votre secteur est de ${adsBudget}€/mois — un bon site + SEO coûte moins et dure plus longtemps.`,
    );
  }

  return args;
}
