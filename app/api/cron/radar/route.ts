import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { twilioClient, twilioConfigured, messagingServiceSid } from "@/app/lib/twilio";
import { SCRAPER_URL } from "@/app/lib/competitor-config";
import { REGION_CITIES } from "@/app/lib/regionCities";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RADAR_PHONE = process.env.RADAR_ADMIN_PHONE ?? "0615907873";
const SCRAPE_LIMIT = 20;
const SCRAPE_TIMEOUT = 120_000;

/** Normalise un numero FR en +33… pour Twilio. */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("33")) return `+${digits}`;
  if (digits.startsWith("0")) return `+33${digits.slice(1)}`;
  return `+${digits}`;
}

interface ScrapedCompetitor {
  name: string;
  phone: string;
  website: string;
  maps_url: string;
  rating: string;
  reviews: string;
  address: string;
  category: string;
}

/**
 * POST /api/cron/radar
 * Cron quotidien : scrape Google Maps par region/metier, detecte les nouveaux prospects,
 * les insere en base, et envoie un SMS recap a l'admin.
 */
export async function POST(req: NextRequest) {
  // Auth
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase non configure" }, { status: 503 });
  }

  // 1. Recuperer les combos actifs (metier, region) depuis la base
  const { data: combos, error: combosErr } = await supabase
    .from("prospects")
    .select("metier, region")
    .not("metier", "is", null)
    .not("region", "is", null);

  if (combosErr) {
    return NextResponse.json({ error: combosErr.message }, { status: 500 });
  }

  // Dedup combos
  const seen = new Set<string>();
  const uniqueCombos: { metier: string; region: string }[] = [];
  for (const row of combos ?? []) {
    if (!row.metier || !row.region) continue;
    const key = `${row.metier}|${row.region}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueCombos.push({ metier: row.metier, region: row.region });
  }

  // 2. Recuperer tous les maps_url existants pour dedup rapide
  const { data: existing } = await supabase
    .from("prospects")
    .select("maps_url")
    .not("maps_url", "is", null);
  const knownUrls = new Set((existing ?? []).map((r) => r.maps_url as string));

  // 3. Scanner chaque combo
  const summary: Record<string, number> = {};
  let totalInserted = 0;
  const errors: string[] = [];

  for (const { metier, region } of uniqueCombos) {
    const cities = REGION_CITIES[region];
    if (!cities) continue;

    for (const ville of cities) {
      try {
        const res = await fetch(`${SCRAPER_URL}/scrape`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metier, ville, limit: SCRAPE_LIMIT, quick: true }),
          signal: AbortSignal.timeout(SCRAPE_TIMEOUT),
        });

        if (!res.ok) {
          errors.push(`${metier}/${ville}: HTTP ${res.status}`);
          continue;
        }

        const json = await res.json();
        const competitors: ScrapedCompetitor[] = json.competitors ?? [];

        // Filtrer : sans site web + pas deja en base
        const newProspects = competitors.filter((c) => {
          if (!c.name || !c.phone) return false;
          const ws = (c.website ?? "").trim().toLowerCase();
          if (ws && ws !== "yes" && ws !== "non" && ws.startsWith("http")) return false;
          if (c.maps_url && knownUrls.has(c.maps_url)) return false;
          return true;
        });

        if (newProspects.length === 0) continue;

        // Inserer en batch
        const rows = newProspects.map((c) => ({
          name: c.name,
          metier,
          phone: c.phone,
          ville,
          region,
          rating: c.rating ? parseFloat(c.rating) || null : null,
          reviews: c.reviews ? parseInt(c.reviews, 10) || null : null,
          address: c.address || null,
          maps_url: c.maps_url || null,
          website: ws(c),
          status: "todo",
          source: "radar",
          radar_detected_at: new Date().toISOString(),
        }));

        const { data: inserted, error: insertErr } = await supabase
          .from("prospects")
          .upsert(rows, { onConflict: "maps_url", ignoreDuplicates: true })
          .select("id");

        const count = inserted?.length ?? 0;
        if (insertErr) {
          errors.push(`insert ${metier}/${ville}: ${insertErr.message}`);
        } else if (count > 0) {
          const label = `${metier} ${region}`;
          summary[label] = (summary[label] ?? 0) + count;
          totalInserted += count;
          // Ajouter au set pour eviter les doublons intra-run
          for (const c of newProspects) {
            if (c.maps_url) knownUrls.add(c.maps_url);
          }
        }
      } catch (e) {
        errors.push(`${metier}/${ville}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // 4. SMS recap si nouveaux prospects
  if (totalInserted > 0 && twilioConfigured) {
    const detail = Object.entries(summary)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ");
    const body = `Radar: ${totalInserted} nouveaux prospects detectes cette nuit (${detail}). Ouvre l'app pour les voir.`;

    try {
      await twilioClient().messages.create({
        to: toE164(RADAR_PHONE),
        messagingServiceSid,
        body,
      });
    } catch (e) {
      errors.push(`SMS: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    scanned: uniqueCombos.length,
    totalInserted,
    summary,
    errors: errors.length > 0 ? errors : undefined,
  });
}

function ws(c: ScrapedCompetitor): string | null {
  const w = (c.website ?? "").trim();
  if (!w || w === "yes" || w === "non") return null;
  return w;
}
