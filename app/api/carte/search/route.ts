import { NextRequest, NextResponse } from "next/server";
import { SCRAPER_URL } from "@/app/lib/competitor-config";

export async function POST(request: NextRequest) {
  try {
    const { metier, ville, limit = 20 } = (await request.json()) as {
      metier: string;
      ville: string;
      limit?: number;
    };

    if (!metier || !ville) {
      return NextResponse.json(
        { error: "metier and ville are required" },
        { status: 400 },
      );
    }

    const scraperRes = await fetch(SCRAPER_URL + "/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metier, ville, limit }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!scraperRes.ok) {
      return NextResponse.json(
        { error: "Scraper error", status: scraperRes.status },
        { status: 502 },
      );
    }

    const json = await scraperRes.json();
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
