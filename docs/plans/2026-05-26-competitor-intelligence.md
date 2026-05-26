# Local Competitor Intelligence — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add competitor analysis for each prospect — scrape Google Maps for local competitors, score their GBP, and estimate Google Ads budgets.

**Architecture:** A Python FastAPI + Scrapling scraper runs on the VPS (port 8001). Next.js API route `/api/competitor/analyze` calls the scraper, computes GBP scores and Ads budget estimates, persists to Supabase, and returns data to the frontend. A new section in CallModal displays the report.

**Tech Stack:** Python 3 / FastAPI / Scrapling (VPS), Next.js 15 API routes (Vercel), Supabase (DB), React + Tailwind (UI)

---

## Task 1: VPS Scraper — FastAPI Project

**Files:**
- Create: `vps/scraper/main.py`
- Create: `vps/scraper/requirements.txt`
- Create: `vps/scraper/README.md`

This is a standalone Python project that will be deployed to the VPS separately.

**Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
scrapling==0.2.9
```

**Step 2: Create main.py — the scraper API**

```python
import asyncio
import re
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scrapling.defaults import Adaptor
from scrapling.fetchers import PlayWrightFetcher

app = FastAPI(title="ScrapProsp Scraper")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class ScrapeRequest(BaseModel):
    ville: str
    metier: str
    limit: int = 10

class Competitor(BaseModel):
    name: str
    rating: float | None = None
    reviews: int | None = None
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    maps_url: str | None = None
    category: str | None = None

class ScrapeResponse(BaseModel):
    competitors: list[Competitor]
    query: str
    ville: str
    metier: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape(req: ScrapeRequest):
    query = f"{req.metier} {req.ville}"
    maps_url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"

    fetcher = PlayWrightFetcher(headless=True, disable_resources=True)
    page = await fetcher.async_fetch(maps_url, wait_selector='div[role="feed"]', timeout=30000)

    # Scroll the feed to load results
    competitors = []
    # ... (extraction logic adapted from existing scraper)
    # For now, parse the initial feed results

    feed_items = page.css('div[role="feed"] > div > div > a')
    seen = set()

    for i, item in enumerate(feed_items):
        if len(competitors) >= req.limit:
            break

        aria = item.attrib.get("aria-label", "").strip()
        if not aria or aria in seen:
            continue
        seen.add(aria)

        # Click into place detail and extract data
        # This will be refined — initial version extracts from feed cards
        comp = Competitor(name=aria)

        # Extract rating from aria label pattern "X,X etoiles" or card content
        # Extract review count
        # These will be filled by clicking into each result

        competitors.append(comp)

    return ScrapeResponse(
        competitors=competitors,
        query=query,
        ville=req.ville,
        metier=req.metier,
    )
```

> **Note:** The full extraction logic (clicking into each place, extracting phone/rating/reviews/website/address) will be refined in Task 2. This task sets up the project structure.

**Step 3: Create README.md with deploy instructions**

```markdown
# ScrapProsp Scraper (VPS)

## Local dev
pip install -r requirements.txt
scrapling install
uvicorn main:app --port 8001 --reload

## VPS deploy
ssh root@51.255.200.169
# see Task 7 for full deploy steps
```

**Step 4: Commit**

```bash
git add vps/
git commit -m "feat: scaffold VPS scraper project (FastAPI + Scrapling)"
```

---

## Task 2: VPS Scraper — Full Extraction Logic

**Files:**
- Modify: `vps/scraper/main.py`

Adapt the extraction logic from the existing `scrape_all_regions.py` (which uses Playwright) to work with Scrapling. The key difference: we want ALL competitors (including those with websites), and we extract website URLs.

**Step 1: Implement the full scrape endpoint**

The scraper must:
1. Navigate to Google Maps search for `{metier} {ville}`
2. Accept cookies if prompted
3. Scroll the feed to load enough results
4. Click into each result to extract detailed data:
   - `name` — from `h1.DUwDvf` or `h1`
   - `rating` — from `div.F7nice span[aria-hidden="true"]`
   - `reviews` — from `div.F7nice span` matching `(\d+)` pattern
   - `phone` — from `button[data-tooltip="Copier le numero de telephone"]` aria-label
   - `address` — from `button[data-tooltip="Copier l'adresse"]` aria-label
   - `website` — from `a[data-item-id="authority"]` href
   - `maps_url` — current page URL
   - `category` — from `button.DkEaL` text
5. Navigate back and continue to next result
6. Return up to `limit` results

**Step 2: Add error handling and timeouts**

- Per-place timeout: 10 seconds
- Total request timeout: 120 seconds (for limit=20)
- Graceful handling of missing elements
- Return partial results if some extractions fail

**Step 3: Test locally**

```bash
cd vps/scraper
pip install -r requirements.txt
scrapling install
uvicorn main:app --port 8001 --reload

# Test with curl
curl -X POST http://localhost:8001/scrape \
  -H "Content-Type: application/json" \
  -d '{"ville":"Limoges","metier":"plombier","limit":5}'
```

**Step 4: Commit**

```bash
git add vps/scraper/main.py
git commit -m "feat: implement full Google Maps extraction in scraper"
```

---

## Task 3: Supabase Migration — competitor_reports Table

**Files:**
- Modify: `supabase/migration.sql` (append)
- Create: `supabase/migration-002-competitor-reports.sql`

**Step 1: Create the migration file**

```sql
-- Competitor analysis reports
CREATE TABLE competitor_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  ville           text NOT NULL,
  metier          text NOT NULL,
  competitors     jsonb NOT NULL DEFAULT '[]',
  ads_budget_est  numeric,
  limit_used      integer NOT NULL DEFAULT 10,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_competitor_reports_prospect ON competitor_reports(prospect_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE competitor_reports;
```

**Step 2: Run migration on Supabase**

Go to Supabase Dashboard > SQL Editor and execute the migration SQL.

**Step 3: Commit**

```bash
git add supabase/migration-002-competitor-reports.sql
git commit -m "feat: add competitor_reports table migration"
```

---

## Task 4: TypeScript Types + Config

**Files:**
- Modify: `app/lib/types.ts`
- Create: `app/lib/competitor-config.ts`

**Step 1: Add types to `app/lib/types.ts`**

Append to the existing file:

```typescript
export interface CompetitorResult {
  name: string;
  rating: number | null;
  reviews: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  category: string | null;
  gbp_score: number;
}

export interface CompetitorReport {
  id: string;
  prospect_id: string;
  ville: string;
  metier: string;
  competitors: CompetitorResult[];
  ads_budget_est: number | null;
  limit_used: number;
  created_at: string;
}
```

**Step 2: Create `app/lib/competitor-config.ts`**

```typescript
export const CPC_PAR_METIER: Record<string, number> = {
  plombier: 3.0,
  electricien: 2.5,
  paysagiste: 2.0,
};

export const DEFAULT_CPC = 2.5;
export const CTR = 0.035; // 3.5%

// Monthly search volume coefficient per 10k inhabitants
export const VOLUME_COEFF: Record<string, number> = {
  plombier: 120,
  electricien: 90,
  paysagiste: 60,
};

export const DEFAULT_VOLUME_COEFF = 80;

export const SCRAPER_URL = process.env.SCRAPER_URL || "http://51.255.200.169:8001";

export const REPORT_CACHE_DAYS = 7;
```

**Step 3: Commit**

```bash
git add app/lib/types.ts app/lib/competitor-config.ts
git commit -m "feat: add competitor types and CPC config"
```

---

## Task 5: Next.js API Route — /api/competitor/analyze

**Files:**
- Create: `app/api/competitor/analyze/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  CPC_PAR_METIER, DEFAULT_CPC, CTR,
  VOLUME_COEFF, DEFAULT_VOLUME_COEFF,
  SCRAPER_URL, REPORT_CACHE_DAYS,
} from "@/app/lib/competitor-config";
import type { CompetitorResult } from "@/app/lib/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

function computeGbpScore(c: { rating: number | null; reviews: number | null; website: string | null }): number {
  const ratingScore = c.rating ? (c.rating / 5) * 40 : 0;
  const reviewScore = c.reviews ? Math.min(Math.log10(c.reviews + 1) / Math.log10(500), 1) * 40 : 0;
  const websiteScore = c.website ? 20 : 0;
  return Math.round(ratingScore + reviewScore + websiteScore);
}

function estimateAdsBudget(metier: string, ville: string): number {
  const cpc = CPC_PAR_METIER[metier.toLowerCase()] ?? DEFAULT_CPC;
  const volumeCoeff = VOLUME_COEFF[metier.toLowerCase()] ?? DEFAULT_VOLUME_COEFF;
  // Rough estimate: small city ~ 20k inhabitants
  const estimatedVolume = (20_000 / 10_000) * volumeCoeff;
  return Math.round(cpc * estimatedVolume * CTR);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prospectId, limit = 10 } = body;

    if (!prospectId) {
      return NextResponse.json({ error: "prospectId required" }, { status: 400 });
    }

    // Get prospect data
    const { data: prospect, error: pErr } = await supabase
      .from("prospects")
      .select("id, ville, metier, name, rating, reviews, maps_url")
      .eq("id", prospectId)
      .single();

    if (pErr || !prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    // Check cache
    const cacheDate = new Date();
    cacheDate.setDate(cacheDate.getDate() - REPORT_CACHE_DAYS);

    const { data: cached } = await supabase
      .from("competitor_reports")
      .select("*")
      .eq("prospect_id", prospectId)
      .eq("limit_used", limit)
      .gte("created_at", cacheDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      return NextResponse.json(cached);
    }

    // Call VPS scraper
    const scrapeRes = await fetch(`${SCRAPER_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ville: prospect.ville,
        metier: prospect.metier,
        limit,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!scrapeRes.ok) {
      const errText = await scrapeRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Scraper error: ${scrapeRes.status} ${errText.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const scrapeData = await scrapeRes.json();

    // Score competitors
    const competitors: CompetitorResult[] = (scrapeData.competitors || []).map(
      (c: Record<string, unknown>) => ({
        ...c,
        gbp_score: computeGbpScore(c as { rating: number | null; reviews: number | null; website: string | null }),
      }),
    );
    competitors.sort((a, b) => b.gbp_score - a.gbp_score);

    // Estimate Ads budget
    const adsBudgetEst = estimateAdsBudget(prospect.metier, prospect.ville);

    // Save report
    const { data: report, error: insertErr } = await supabase
      .from("competitor_reports")
      .insert({
        prospect_id: prospectId,
        ville: prospect.ville,
        metier: prospect.metier,
        competitors,
        ads_budget_est: adsBudgetEst,
        limit_used: limit,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Failed to save report:", insertErr);
      // Still return the data even if save fails
      return NextResponse.json({
        prospect_id: prospectId,
        ville: prospect.ville,
        metier: prospect.metier,
        competitors,
        ads_budget_est: adsBudgetEst,
        limit_used: limit,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(report);
  } catch (err) {
    console.error("Competitor analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
```

**Step 2: Add `SCRAPER_URL` to `.env`**

Append to `.env` (or `.env.local`):

```
SCRAPER_URL=http://51.255.200.169:8001
```

**Step 3: Verify the middleware allows API routes**

Check `middleware.ts` — API routes under `/api/` are matched by the middleware. The auth cookie check applies. This is correct since only logged-in users should trigger analyses.

**Step 4: Commit**

```bash
git add app/api/competitor/analyze/route.ts
git commit -m "feat: add /api/competitor/analyze API route with scoring"
```

---

## Task 6: Frontend — CompetitorSection Component

**Files:**
- Create: `app/components/CompetitorSection.tsx`
- Modify: `app/components/CallModal.tsx`

**Step 1: Create `CompetitorSection.tsx`**

A collapsible section that:
- Shows a "Analyser la concurrence" button with limit selector (5/10/20)
- Calls `/api/competitor/analyze` on click
- Displays loading state (~15-30s)
- Shows the competitor table with GBP scores
- Shows the prospect's position in the ranking
- Shows the estimated Ads budget
- Shows cached report if available (< 7 days) with "Relancer" option

Key UI elements:
- `<details>` section matching the existing CallModal style (same as RDV and QR sections)
- Competitor table: rank, name, note (stars), avis count, site web (oui/non badge), score bar
- Prospect row highlighted in the table
- Ads budget card with CPC and volume breakdown
- "Relancer l'analyse" link if showing cached data
- Loading skeleton matching project's dark theme

Icons to use from lucide-react: `BarChart3`, `Trophy`, `Globe`, `Loader2`, `RefreshCw`, `TrendingUp`

**Step 2: Integrate into CallModal**

Add the `CompetitorSection` as a new `<details>` block in `CallModal.tsx`, placed after the QR code section and before the ntfy setup section (around line 391).

Props needed from CallModal:
- `prospectId: string`
- `ville: string`
- `metier: string`
- `prospectName: string`
- `prospectRating: number | null`
- `prospectReviews: number | null`

**Step 3: Commit**

```bash
git add app/components/CompetitorSection.tsx app/components/CallModal.tsx
git commit -m "feat: add competitor analysis section to CallModal"
```

---

## Task 7: VPS Deployment

**Files:** None (SSH commands on VPS)

This task is for deploying the scraper to the VPS. Run these commands via SSH.

**Step 1: SSH into VPS and install dependencies**

```bash
ssh root@51.255.200.169

# Install Python 3.11+ and pip
apt update && apt install -y python3 python3-venv python3-pip

# Install Node.js 20 + PM2 (for process management)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

**Step 2: Setup the scraper**

```bash
# Create project directory
mkdir -p /opt/scrapprosp-scraper
cd /opt/scrapprosp-scraper

# Create venv
python3 -m venv venv
source venv/bin/activate

# Copy files (scp from local)
# scp -r vps/scraper/* root@51.255.200.169:/opt/scrapprosp-scraper/

# Install dependencies
pip install -r requirements.txt
scrapling install  # downloads Chromium

# Test it works
uvicorn main:app --host 0.0.0.0 --port 8001
# Ctrl+C to stop
```

**Step 3: Setup PM2 process**

```bash
pm2 start "venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001" \
  --name scraper \
  --cwd /opt/scrapprosp-scraper

pm2 save
pm2 startup  # auto-start on reboot
```

**Step 4: Verify from local machine**

```bash
curl -X POST http://51.255.200.169:8001/scrape \
  -H "Content-Type: application/json" \
  -d '{"ville":"Limoges","metier":"plombier","limit":3}'
```

**Step 5: Open port 8001 in firewall (if needed)**

```bash
# On VPS
ufw allow 8001/tcp
# Or if using iptables:
iptables -A INPUT -p tcp --dport 8001 -j ACCEPT
```

---

## Execution Order

```
Task 1 + 2 : VPS scraper (can develop locally)
Task 3     : Supabase migration (run SQL in dashboard)
Task 4     : TypeScript types + config
Task 5     : API route
Task 6     : Frontend UI
Task 7     : VPS deployment (when ready to go live)
```

Tasks 1-2 and 3 can be done in parallel.
Tasks 4 → 5 → 6 are sequential.
Task 7 is independent, done when everything works locally.
