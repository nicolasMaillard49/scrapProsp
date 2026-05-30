import { NextRequest, NextResponse } from "next/server";
import { SCRAPER_URL } from "@/app/lib/competitor-config";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { name, metier, ville, rating, reviews, website, maps_url } =
      (await request.json()) as {
        name: string;
        metier: string;
        ville: string;
        rating: number | null;
        reviews: number | null;
        website: string | null;
        maps_url: string;
      };

    if (!name || !maps_url) {
      return NextResponse.json(
        { error: "name and maps_url are required" },
        { status: 400 },
      );
    }

    if (!supabaseConfigured) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 },
      );
    }

    // Check if prospect already exists
    const { data: existing } = await supabase
      .from("prospects")
      .select("id")
      .eq("maps_url", maps_url)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Ce prospect existe déjà dans votre liste", existing: true },
        { status: 409 },
      );
    }

    // Enrich: get phone + address from VPS scraper
    let phone = "";
    let enrichedAddress = "";
    let enrichedWebsite = website || "";

    try {
      const enrichRes = await fetch(SCRAPER_URL + "/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maps_url }),
        signal: AbortSignal.timeout(60_000),
      });

      if (enrichRes.ok) {
        const enrichData = await enrichRes.json();
        phone = enrichData.phone || "";
        if (enrichData.address) enrichedAddress = enrichData.address;
        if (enrichData.website && !enrichedWebsite) {
          enrichedWebsite = enrichData.website;
        }
      }
    } catch (err) {
      console.error("Enrich failed (continuing without):", err);
    }

    // Insert prospect into Supabase
    const { data, error } = await supabase
      .from("prospects")
      .insert({
        name,
        metier: metier || "",
        phone,
        ville: ville || "",
        departement: "",
        region: "",
        region_label: null,
        rating: rating != null ? Number(rating) : null,
        reviews: reviews != null ? Number(reviews) : null,
        address: enrichedAddress || null,
        maps_url,
        status: "todo",
        notes: "",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prospect: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
