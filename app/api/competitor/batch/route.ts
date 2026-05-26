import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import {
  estimateAdsTiers,
  SCRAPER_URL,
  REPORT_CACHE_DAYS,
} from "@/app/lib/competitor-config";
import type { CompetitorResult } from "@/app/lib/types";

function computeGbpScore(
  rating: number | null,
  reviews: number | null,
  hasWebsite: boolean,
): number {
  const ratingScore = rating != null ? (rating / 5) * 40 : 0;
  const reviewsScore =
    reviews != null
      ? Math.min(Math.log10(reviews + 1) / Math.log10(500), 1) * 40
      : 0;
  const websiteScore = hasWebsite ? 20 : 0;
  return Math.round(ratingScore + reviewsScore + websiteScore);
}

// Removed: single budget → now using estimateAdsTiers from config

/**
 * POST /api/competitor/batch
 *
 * Batch-analyze competitors for prospects with status "positive" or "called"
 * that don't have a recent report. Used by the weekly cron job.
 *
 * Body: { statuses?: string[], limit?: number, maxProspects?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      statuses = ["positive", "called"],
      limit = 10,
      maxProspects = 50,
    } = body as {
      statuses?: string[];
      limit?: number;
      maxProspects?: number;
    };

    // 1. Get prospects matching statuses
    const { data: prospects, error: fetchError } = await supabase
      .from("prospects")
      .select("id, ville, metier, name, rating, reviews")
      .in("status", statuses)
      .limit(maxProspects);

    if (fetchError || !prospects) {
      return NextResponse.json(
        { error: "Failed to fetch prospects", details: fetchError?.message },
        { status: 500 },
      );
    }

    // 2. Filter out those with a recent report
    const cacheThreshold = new Date();
    cacheThreshold.setDate(cacheThreshold.getDate() - REPORT_CACHE_DAYS);

    const prospectIds = prospects.map((p) => p.id);

    const { data: recentReports } = await supabase
      .from("competitor_reports")
      .select("prospect_id")
      .in("prospect_id", prospectIds)
      .gte("created_at", cacheThreshold.toISOString());

    const recentIds = new Set((recentReports ?? []).map((r) => r.prospect_id));
    const toAnalyze = prospects.filter((p) => !recentIds.has(p.id));

    if (toAnalyze.length === 0) {
      return NextResponse.json({
        message: "All prospects have recent reports",
        analyzed: 0,
        total: prospects.length,
      });
    }

    // 3. Analyze each prospect sequentially
    const results: { prospectId: string; name: string; success: boolean; error?: string }[] = [];

    for (const prospect of toAnalyze) {
      try {
        const scraperRes = await fetch(SCRAPER_URL + "/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ville: prospect.ville,
            metier: prospect.metier,
            limit,
          }),
          signal: AbortSignal.timeout(120_000),
        });

        if (!scraperRes.ok) {
          results.push({
            prospectId: prospect.id,
            name: prospect.name,
            success: false,
            error: `Scraper ${scraperRes.status}`,
          });
          continue;
        }

        const json = await scraperRes.json();
        const scraperData = json.competitors || [];

        const competitors: CompetitorResult[] = scraperData.map(
          (c: { rating: string; reviews: string; website: string; name: string; address: string; phone: string; maps_url: string; category: string }) => {
            const rating =
              c.rating != null && c.rating !== ""
                ? parseFloat(c.rating.replace(",", "."))
                : null;
            const parsedRating = rating !== null && !isNaN(rating) ? rating : null;
            const reviews =
              c.reviews != null && c.reviews !== ""
                ? parseInt(c.reviews, 10)
                : null;
            const parsedReviews = reviews !== null && !isNaN(reviews) ? reviews : null;
            const hasWebsite = !!c.website && c.website.length > 0;

            return {
              name: c.name,
              rating: parsedRating,
              reviews: parsedReviews,
              address: c.address || null,
              phone: c.phone || null,
              website: c.website || null,
              maps_url: c.maps_url || null,
              category: c.category || null,
              gbp_score: computeGbpScore(parsedRating, parsedReviews, hasWebsite),
            };
          },
        );

        competitors.sort((a, b) => b.gbp_score - a.gbp_score);

        const adsTiers = estimateAdsTiers(prospect.metier);
        const report = {
          prospect_id: prospect.id,
          ville: prospect.ville,
          metier: prospect.metier,
          competitors,
          ads_budget_est: adsTiers[0].budget,
          ads_tiers: adsTiers,
          limit_used: limit,
        };

        const { error: insertError } = await supabase
          .from("competitor_reports")
          .insert(report);

        results.push({
          prospectId: prospect.id,
          name: prospect.name,
          success: !insertError,
          error: insertError?.message,
        });
      } catch (err) {
        results.push({
          prospectId: prospect.id,
          name: prospect.name,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Batch complete: ${succeeded}/${toAnalyze.length} analyzed`,
      analyzed: succeeded,
      skipped: prospects.length - toAnalyze.length,
      total: prospects.length,
      results,
    });
  } catch (err) {
    console.error("Batch analysis error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
