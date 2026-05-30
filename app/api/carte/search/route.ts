// Migration: run this SQL in Supabase to create the search_cache table
// CREATE TABLE search_cache (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   metier text NOT NULL,
//   ville text NOT NULL,
//   limit_used int NOT NULL DEFAULT 20,
//   results jsonb NOT NULL,
//   created_at timestamptz DEFAULT now()
// );
// CREATE INDEX idx_search_cache_lookup ON search_cache (metier, ville, limit_used, created_at DESC);

import { NextRequest, NextResponse } from "next/server";
import { SCRAPER_URL } from "@/app/lib/competitor-config";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

const CACHE_HOURS = 24;

export async function POST(request: NextRequest) {
  try {
    const { metier, ville, limit = 20, force = false } = (await request.json()) as {
      metier: string;
      ville: string;
      limit?: number;
      force?: boolean;
    };

    if (!metier || !ville) {
      return NextResponse.json(
        { error: "metier and ville are required" },
        { status: 400 },
      );
    }

    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);

    // 1. Check cache (skip if force or Supabase not configured)
    if (supabaseConfigured && !force) {
      const cacheThreshold = new Date();
      cacheThreshold.setHours(cacheThreshold.getHours() - CACHE_HOURS);

      const { data: cached } = await supabase
        .from("search_cache")
        .select("*")
        .eq("metier", metier)
        .eq("ville", ville)
        .eq("limit_used", safeLimit)
        .gte("created_at", cacheThreshold.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (cached) {
        return NextResponse.json(cached.results);
      }
    }

    // 2. Call VPS scraper with quick mode (no phone/address enrichment)
    const scraperRes = await fetch(SCRAPER_URL + "/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metier, ville, limit: safeLimit, quick: true }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!scraperRes.ok) {
      return NextResponse.json(
        { error: "Scraper error", status: scraperRes.status },
        { status: 502 },
      );
    }

    const json = await scraperRes.json();

    // 3. Save results to cache (best effort, skip if Supabase not configured)
    if (supabaseConfigured) {
      const { error: insertError } = await supabase
        .from("search_cache")
        .insert({
          metier,
          ville,
          limit_used: safeLimit,
          results: json,
        });

      if (insertError) {
        console.error("Failed to cache search results:", insertError.message);
      }
    }

    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to reach scraper",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
