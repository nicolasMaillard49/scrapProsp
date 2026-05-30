"""
VPS Scraper — FastAPI + Playwright for Google Maps competitor intelligence.

Endpoints:
  GET  /health  -> {"status": "ok"}
  POST /scrape  -> scrape Google Maps for competitors in a given city/trade
"""

import asyncio
import logging
import re
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("scraper")

# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------
_playwright = None
_browser = None

REQUEST_TIMEOUT = 120  # seconds

# In-memory cache: key -> {"data": ScrapeResponse, "ts": float}
_cache: dict[tuple, dict] = {}
CACHE_TTL = 86400  # 24 hours in seconds

# Names that are clearly not real businesses (page artifacts)
BLACKLISTED_NAMES = {"résultats", "results", "rechercher", "search", "plus de résultats"}


# ---------------------------------------------------------------------------
# Lifespan: launch / close the browser once
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _playwright, _browser
    _playwright = await async_playwright().start()
    _browser = await _playwright.chromium.launch(headless=True)
    yield
    await _browser.close()
    await _playwright.stop()


app = FastAPI(title="ScrapProsp VPS Scraper", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class ScrapeRequest(BaseModel):
    ville: str = Field(..., min_length=1, examples=["Limoges"])
    metier: str = Field(..., min_length=1, examples=["plombier"])
    limit: int = Field(default=10, ge=1, le=50)
    quick: bool = Field(default=False, description="Skip enrichment (phone/address) for faster results")


class Competitor(BaseModel):
    name: str = ""
    rating: str = ""
    reviews: str = ""
    phone: str = ""
    address: str = ""
    website: str = ""
    maps_url: str = ""
    category: str = ""


class ScrapeResponse(BaseModel):
    competitors: list[Competitor]
    query: str
    ville: str
    metier: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def accept_cookies(page) -> None:
    """Dismiss the Google cookie consent banner if present."""
    try:
        consent = page.locator('button:has-text("Tout accepter")')
        if await consent.count() > 0:
            await consent.first.click()
            await page.wait_for_timeout(2000)
    except Exception:
        pass


async def scroll_feed(page, target: int) -> int:
    """Scroll the results feed until we have enough items or hit the end.

    Returns the total number of result links found.
    """
    prev_count = 0
    stale_rounds = 0
    for _ in range(80):
        current = await page.locator('div[role="feed"] a[href*="/maps/place/"]').count()
        if current >= target:
            break

        await page.evaluate(
            """() => {
                const f = document.querySelector('div[role="feed"]');
                if (f) f.scrollBy(0, 800);
            }"""
        )
        await page.wait_for_timeout(1500)

        end = await page.evaluate(
            """() => {
                const f = document.querySelector('div[role="feed"]');
                if (!f) return false;
                return f.innerText.includes('Vous avez atteint')
                    || f.innerText.includes("You've reached")
                    || f.querySelector('span.HlvSq') !== null;
            }"""
        )
        if end:
            break

        new_count = await page.locator('div[role="feed"] a[href*="/maps/place/"]').count()
        if new_count == prev_count and new_count > 0:
            stale_rounds += 1
            if stale_rounds >= 3:
                break
        else:
            stale_rounds = 0
        prev_count = new_count

    return await page.locator('div[role="feed"] a[href*="/maps/place/"]').count()


async def extract_feed_items(page, limit: int) -> list[dict]:
    """Extract competitor data directly from the feed listing using JS evaluation.

    This is much more reliable than clicking into each place and navigating back.
    Returns basic data: name, rating, reviews, website presence, maps_url.
    """
    items = await page.evaluate("""(limit) => {
        const feed = document.querySelector('div[role="feed"]');
        if (!feed) return [];

        const links = feed.querySelectorAll('a[href*="/maps/place/"]');
        const results = [];
        const seen = new Set();

        for (const link of links) {
            if (results.length >= limit) break;

            const name = (link.getAttribute('aria-label') || '').trim();
            if (!name || seen.has(name)) continue;
            seen.add(name);

            const href = link.getAttribute('href') || '';

            // Walk up to find the card container (typically 2-3 levels up)
            let card = link.parentElement;
            for (let i = 0; i < 4 && card; i++) {
                if (card.parentElement === feed || card.parentElement?.parentElement === feed) break;
                card = card.parentElement;
            }

            const cardText = card ? card.innerText : '';

            // Extract rating: look for pattern like "4,8" or "5,0"
            let rating = '';
            const ratingMatch = cardText.match(/(\d[,,]\d)\s*\(/);
            if (ratingMatch) {
                rating = ratingMatch[1].replace(',', '.');
            }

            // Extract review count: number in parentheses after rating
            let reviews = '';
            const reviewMatch = cardText.match(/\((\d[\d\s\u202f.,]*)\)/);
            if (reviewMatch) {
                reviews = reviewMatch[1].replace(/[\s\u202f.,]/g, '');
            }

            // Check for website link
            let hasWebsite = false;
            if (card) {
                const siteLink = card.querySelector('a[data-value="Site Web"], a[data-value="Website"]');
                hasWebsite = !!siteLink;
                // Also check for "Site Web" or "Website" text in buttons/links
                if (!hasWebsite) {
                    const allLinks = card.querySelectorAll('a');
                    for (const a of allLinks) {
                        const t = (a.textContent || '').trim().toLowerCase();
                        if (t === 'site web' || t === 'website') {
                            hasWebsite = true;
                            break;
                        }
                    }
                }
            }

            // Extract category from card text (usually first line after name)
            let category = '';
            const lines = cardText.split('\\n').map(l => l.trim()).filter(Boolean);
            // Category is typically after name, before address
            for (const line of lines) {
                if (line === name) continue;
                if (/^\d/.test(line)) continue; // skip if starts with number (rating, address)
                if (line.includes('Ouvert') || line.includes('Fermé') || line.includes('Open') || line.includes('Closed')) continue;
                if (line.includes('Itinéraires') || line.includes('Directions')) continue;
                if (line.includes('Site Web') || line.includes('Website')) continue;
                if (line.match(/^\d[,,]\d/)) continue; // rating line
                if (line.match(/\(\d/)) continue; // reviews line
                // This could be the category
                if (!category && line.length < 60) {
                    category = line;
                }
            }

            results.push({
                name,
                rating,
                reviews,
                website: hasWebsite ? 'yes' : '',
                maps_url: href.startsWith('http') ? href : 'https://www.google.com' + href,
                category,
            });
        }

        return results;
    }""", limit + 10)

    return items


async def enrich_with_details(page, items: list[dict], original_url: str) -> list[Competitor]:
    """Click into each place to get phone and address. Falls back gracefully."""
    competitors: list[Competitor] = []

    for item in items:
        comp = Competitor(
            name=item.get("name", ""),
            rating=item.get("rating", ""),
            reviews=item.get("reviews", ""),
            website=item.get("website", ""),
            maps_url=item.get("maps_url", ""),
            category=item.get("category", ""),
        )

        # Try to click into the place to get phone and address
        try:
            links = page.locator(f'div[role="feed"] a[aria-label="{comp.name}"]')
            if await links.count() > 0:
                await links.first.click()
                await page.wait_for_timeout(3000)

                # Wait for place page
                try:
                    await page.wait_for_selector("h1", timeout=5000)
                except Exception:
                    pass

                if "/place/" in page.url:
                    comp.maps_url = page.url

                    # Phone
                    try:
                        phone_btn = page.locator(
                            'button[data-tooltip="Copier le numéro de téléphone"]'
                        ).first
                        phone_label = await phone_btn.get_attribute("aria-label", timeout=2000)
                        if phone_label and ":" in phone_label:
                            comp.phone = phone_label.split(":")[-1].strip()
                    except Exception:
                        pass

                    # Address
                    try:
                        addr_btn = page.locator(
                            "button[data-tooltip=\"Copier l'adresse\"]"
                        ).first
                        addr_label = await addr_btn.get_attribute("aria-label", timeout=2000)
                        if addr_label:
                            addr = (
                                addr_label.split(":", 1)[-1].strip()
                                if ":" in addr_label
                                else addr_label
                            )
                            comp.address = addr
                    except Exception:
                        pass

                    # Website (get actual URL if not already found)
                    if not comp.website:
                        try:
                            auth = page.locator('a[data-item-id="authority"]')
                            if await auth.count() > 0:
                                href = await auth.first.get_attribute("href", timeout=2000)
                                comp.website = href or ""
                        except Exception:
                            pass

                # Navigate back
                try:
                    back = page.locator('button[aria-label="Retour"]')
                    if await back.count() > 0:
                        await back.first.click()
                    else:
                        await page.go_back()
                    await page.wait_for_selector('div[role="feed"]', timeout=10000)
                    await page.wait_for_timeout(1500)
                except Exception:
                    # If back fails, reload the search
                    try:
                        await page.goto(original_url, wait_until="domcontentloaded", timeout=30000)
                        await page.wait_for_timeout(3000)
                        await accept_cookies(page)
                        await page.wait_for_selector('div[role="feed"]', timeout=15000)
                    except Exception:
                        log.warning(f"Failed to navigate back for {comp.name}, stopping enrichment")
                        competitors.append(comp)
                        break

            log.info(f"Enriched: {comp.name} | phone={comp.phone} | addr={comp.address[:30] if comp.address else ''}")
        except Exception as exc:
            log.warning(f"Could not enrich {comp.name}: {str(exc)[:80]}")

        competitors.append(comp)

    return competitors


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/cache/stats")
async def cache_stats():
    """Return cache size, keys, and per-entry age."""
    now = time.time()
    keys = []
    for key, entry in _cache.items():
        metier, ville, limit, quick = key
        age_s = int(now - entry["ts"])
        keys.append({
            "metier": metier,
            "ville": ville,
            "limit": limit,
            "quick": quick,
            "age_seconds": age_s,
            "competitors_count": len(entry["data"].competitors),
        })
    return {"size": len(_cache), "entries": keys}


@app.delete("/cache")
async def cache_clear():
    """Clear the entire in-memory cache."""
    count = len(_cache)
    _cache.clear()
    log.info(f"Cache cleared ({count} entries removed)")
    return {"cleared": count}


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape(req: ScrapeRequest):
    # Build cache key (normalized to lowercase for better hit rate)
    cache_key = (req.metier.lower(), req.ville.lower(), req.limit, req.quick)

    # Check cache
    now = time.time()
    if cache_key in _cache:
        entry = _cache[cache_key]
        if now - entry["ts"] < CACHE_TTL:
            log.info(f"Cache hit for {req.metier} {req.ville} (quick={req.quick})")
            return entry["data"]
        else:
            # Expired entry — remove it
            del _cache[cache_key]
            log.info(f"Cache expired for {req.metier} {req.ville} (quick={req.quick})")

    log.info(f"Cache miss for {req.metier} {req.ville} (quick={req.quick})")

    query = f"{req.metier}+{req.ville}"
    url = f"https://www.google.com/maps/search/{query}"

    try:
        competitors: list[Competitor] = await asyncio.wait_for(
            _do_scrape(url, req.limit, req.quick),
            timeout=REQUEST_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail=f"Scrape timed out after {REQUEST_TIMEOUT}s",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    response = ScrapeResponse(
        competitors=competitors,
        query=f"{req.metier} {req.ville}",
        ville=req.ville,
        metier=req.metier,
    )

    # Store in cache
    _cache[cache_key] = {"data": response, "ts": now}
    log.info(f"Cached result for {req.metier} {req.ville} (quick={req.quick}, {len(competitors)} competitors)")

    return response


class EnrichRequest(BaseModel):
    maps_url: str = Field(..., min_length=1)


class EnrichResponse(BaseModel):
    phone: str = ""
    address: str = ""
    website: str = ""


@app.post("/enrich", response_model=EnrichResponse)
async def enrich(req: EnrichRequest):
    """Navigate directly to a Google Maps place URL and extract phone/address/website."""
    log.info(f"Enrich request for {req.maps_url[:80]}")
    try:
        result = await asyncio.wait_for(
            _do_enrich(req.maps_url),
            timeout=REQUEST_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Enrich timed out")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return result


async def _do_enrich(maps_url: str) -> EnrichResponse:
    """Core enrichment logic — open a place page and extract details."""
    context = await _browser.new_context(
        locale="fr-FR",
        viewport={"width": 1280, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
    )
    try:
        page = await context.new_page()
        page.set_default_timeout(15000)

        await page.goto(maps_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)
        await accept_cookies(page)

        try:
            await page.wait_for_selector("h1", timeout=10000)
        except Exception:
            pass

        phone = ""
        address = ""
        website = ""

        # Phone
        try:
            phone_btn = page.locator(
                'button[data-tooltip="Copier le numéro de téléphone"]'
            ).first
            phone_label = await phone_btn.get_attribute("aria-label", timeout=3000)
            if phone_label and ":" in phone_label:
                phone = phone_label.split(":")[-1].strip()
        except Exception:
            pass

        # Address
        try:
            addr_btn = page.locator(
                "button[data-tooltip=\"Copier l'adresse\"]"
            ).first
            addr_label = await addr_btn.get_attribute("aria-label", timeout=3000)
            if addr_label:
                address = (
                    addr_label.split(":", 1)[-1].strip()
                    if ":" in addr_label
                    else addr_label
                )
        except Exception:
            pass

        # Website
        try:
            auth = page.locator('a[data-item-id="authority"]')
            if await auth.count() > 0:
                href = await auth.first.get_attribute("href", timeout=3000)
                website = href or ""
        except Exception:
            pass

        log.info(f"Enriched: phone={phone} addr={address[:40] if address else ''} site={bool(website)}")
        return EnrichResponse(phone=phone, address=address, website=website)
    finally:
        await context.close()


async def _do_scrape(url: str, limit: int, quick: bool = False) -> list[Competitor]:
    """Core scraping logic — runs inside the timeout wrapper."""
    context = await _browser.new_context(
        locale="fr-FR",
        viewport={"width": 1280, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
    )
    try:
        page = await context.new_page()
        page.set_default_timeout(15000)

        # Navigate to Maps search
        log.info(f"Navigating to {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)
        await accept_cookies(page)

        # Wait for the feed
        try:
            await page.wait_for_selector('div[role="feed"]', timeout=15000)
            log.info("Feed found")
        except Exception:
            log.warning("No feed found — page title: %s", await page.title())
            return []

        await page.wait_for_timeout(2000)
        total = await scroll_feed(page, limit)
        log.info(f"Feed has {total} items after scrolling (target: {limit})")

        # Phase 1: Extract basic data from feed (fast, reliable)
        feed_items = await extract_feed_items(page, limit)
        log.info(f"Extracted {len(feed_items)} items from feed")

        # Filter out garbage
        valid_items = []
        for item in feed_items:
            name = item.get("name", "").strip()
            if not name:
                continue
            if name.lower() in BLACKLISTED_NAMES:
                log.warning(f"Skipping blacklisted: {name}")
                continue
            valid_items.append(item)

        log.info(f"{len(valid_items)} valid items after filtering")

        if not valid_items:
            return []

        if quick:
            # Quick mode: skip enrichment, return feed data directly
            log.info("Quick mode — skipping enrichment")
            competitors = [
                Competitor(
                    name=item.get("name", ""),
                    rating=item.get("rating", ""),
                    reviews=item.get("reviews", ""),
                    website=item.get("website", ""),
                    maps_url=item.get("maps_url", ""),
                    category=item.get("category", ""),
                    phone="",
                    address="",
                )
                for item in valid_items[:limit]
            ]
        else:
            # Phase 2: Enrich with phone/address by clicking into each place
            competitors = await enrich_with_details(page, valid_items[:limit], url)

        log.info(f"Final result: {len(competitors)} competitors")
        return competitors
    finally:
        await context.close()
