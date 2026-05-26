import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import {
  CPC_PAR_METIER,
  DEFAULT_CPC,
  MONTHLY_CLICKS,
  DEFAULT_MONTHLY_CLICKS,
  ADS_MARGIN,
  SCRAPER_URL,
  REPORT_CACHE_DAYS,
} from "@/app/lib/competitor-config";
import type { CompetitorResult } from "@/app/lib/types";

/* ---------- helpers ---------- */

function computeGbpScore(
  rating: number | null,
  reviews: number | null,
  hasWebsite: boolean
): number {
  const ratingScore = rating != null ? (rating / 5) * 40 : 0;
  const reviewsScore =
    reviews != null
      ? Math.min(Math.log10(reviews + 1) / Math.log10(500), 1) * 40
      : 0;
  const websiteScore = hasWebsite ? 20 : 0;
  return Math.round(ratingScore + reviewsScore + websiteScore);
}

function estimateAdsBudget(metier: string): number {
  const cpc = CPC_PAR_METIER[metier] ?? DEFAULT_CPC;
  const clicks = MONTHLY_CLICKS[metier] ?? DEFAULT_MONTHLY_CLICKS;
  return Math.round(cpc * clicks * ADS_MARGIN);
}

/* ---------- POST handler ---------- */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospectId, limit = 10 } = body as {
      prospectId?: string;
      limit?: number;
    };

    // 1. Validate
    if (!prospectId) {
      return NextResponse.json(
        { error: "prospectId is required" },
        { status: 400 }
      );
    }

    // 2. Fetch prospect
    const { data: prospect, error: prospectError } = await supabase
      .from("prospects")
      .select("id, ville, metier, name, rating, reviews, maps_url")
      .eq("id", prospectId)
      .single();

    if (prospectError || !prospect) {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }

    // 3. Check cache
    const cacheThreshold = new Date();
    cacheThreshold.setDate(cacheThreshold.getDate() - REPORT_CACHE_DAYS);

    const { data: cached } = await supabase
      .from("competitor_reports")
      .select("*")
      .eq("prospect_id", prospectId)
      .eq("limit_used", limit)
      .gte("created_at", cacheThreshold.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      return NextResponse.json(cached);
    }

    // 4. Call VPS scraper
    let scraperData: Array<{
      name: string;
      rating: string;
      reviews: string;
      phone: string;
      address: string;
      website: string;
      maps_url: string;
      category: string;
    }>;

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
        return NextResponse.json(
          { error: "Scraper returned an error", status: scraperRes.status },
          { status: 502 }
        );
      }

      const json = await scraperRes.json();
      scraperData = json.competitors || [];
    } catch (err) {
      return NextResponse.json(
        {
          error: "Failed to reach scraper",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }

    // 5. Parse and score competitors
    const competitors: CompetitorResult[] = scraperData.map((c) => {
      const rating =
        c.rating != null && c.rating !== ""
          ? parseFloat(c.rating.replace(",", "."))
          : null;
      const parsedRating =
        rating !== null && !isNaN(rating) ? rating : null;

      const reviews =
        c.reviews != null && c.reviews !== ""
          ? parseInt(c.reviews, 10)
          : null;
      const parsedReviews =
        reviews !== null && !isNaN(reviews) ? reviews : null;

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
    });

    // 6. Sort by gbp_score descending
    competitors.sort((a, b) => b.gbp_score - a.gbp_score);

    // 7. Estimate Ads budget
    const adsBudget = estimateAdsBudget(prospect.metier);

    // 8. Build the report
    const report = {
      prospect_id: prospectId,
      ville: prospect.ville,
      metier: prospect.metier,
      competitors,
      ads_budget_est: adsBudget,
      limit_used: limit,
    };

    // 9. Insert into Supabase (best effort)
    const { data: inserted, error: insertError } = await supabase
      .from("competitor_reports")
      .insert(report)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to cache competitor report:", insertError.message);
      return NextResponse.json({ ...report, created_at: new Date().toISOString() });
    }

    return NextResponse.json(inserted);
  } catch (err) {
    console.error("Competitor analysis error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
