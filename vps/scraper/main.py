"""
VPS Scraper — FastAPI + Playwright for Google Maps competitor intelligence.

Endpoints:
  GET  /health  -> {"status": "ok"}
  POST /scrape  -> scrape Google Maps for competitors in a given city/trade
"""

import asyncio
import logging
import re
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
    for _ in range(80):
        current = await page.locator('div[role="feed"] > div > div > a').count()
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
                    || f.querySelector('span.HlvSq') !== null;
            }"""
        )
        if end:
            break

        new_count = await page.locator('div[role="feed"] > div > div > a').count()
        if new_count == prev_count and new_count > 0:
            break
        prev_count = new_count

    return await page.locator('div[role="feed"] > div > div > a').count()


async def extract_place(page) -> Competitor:
    """Extract competitor data from the currently-open place detail panel."""
    data = Competitor()

    # Name
    try:
        data.name = (
            await page.locator("h1.DUwDvf").first.text_content(timeout=5000)
        ).strip()
    except Exception:
        try:
            data.name = (
                await page.locator("h1").first.text_content(timeout=3000)
            ).strip()
        except Exception:
            pass

    # Rating
    try:
        r = await page.locator(
            'div.F7nice span[aria-hidden="true"]'
        ).first.text_content(timeout=2000)
        data.rating = r.strip()
    except Exception:
        pass

    # Reviews count
    try:
        rev_spans = page.locator("div.F7nice span")
        for idx in range(await rev_spans.count()):
            txt = await rev_spans.nth(idx).text_content(timeout=1000)
            m = re.search(r"\((\d[\d\s\u202f.,]*)\)", txt or "")
            if m:
                data.reviews = (
                    m.group(1)
                    .strip()
                    .replace("\u202f", "")
                    .replace(" ", "")
                    .replace(".", "")
                    .replace(",", "")
                )
                break
    except Exception:
        pass

    # Phone
    try:
        phone_btn = page.locator(
            'button[data-tooltip="Copier le numéro de téléphone"]'
        ).first
        phone_label = await phone_btn.get_attribute("aria-label", timeout=2000)
        if phone_label and ":" in phone_label:
            data.phone = phone_label.split(":")[-1].strip()
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
            data.address = addr
    except Exception:
        pass

    # Website
    try:
        auth = page.locator('a[data-item-id="authority"]')
        if await auth.count() > 0:
            href = await auth.first.get_attribute("href", timeout=2000)
            data.website = href or ""
    except Exception:
        pass

    # Category
    try:
        cat_btn = page.locator("button.DkEaL")
        if await cat_btn.count() > 0:
            data.category = (
                await cat_btn.first.text_content(timeout=2000)
            ).strip()
    except Exception:
        pass

    # Maps URL
    data.maps_url = page.url

    return data


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape(req: ScrapeRequest):
    query = f"{req.metier}+{req.ville}"
    url = f"https://www.google.com/maps/search/{query}"

    context = None
    try:
        competitors: list[Competitor] = await asyncio.wait_for(
            _do_scrape(url, req.limit),
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

    return ScrapeResponse(
        competitors=competitors,
        query=f"{req.metier} {req.ville}",
        ville=req.ville,
        metier=req.metier,
    )


async def _go_back_to_feed(page) -> bool:
    """Navigate back to the results feed and wait for it to be ready."""
    try:
        back = page.locator('button[aria-label="Retour"]')
        if await back.count() > 0:
            await back.first.click()
        else:
            await page.go_back()
        # Wait for feed to reappear
        await page.wait_for_selector('div[role="feed"]', timeout=10000)
        await page.wait_for_timeout(2000)
        return True
    except Exception:
        return False


async def _do_scrape(url: str, limit: int) -> list[Competitor]:
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
            # Take screenshot for debugging
            return []

        await page.wait_for_timeout(2000)
        total = await scroll_feed(page, limit)
        log.info(f"Feed has {total} items after scrolling (target: {limit})")
        competitors: list[Competitor] = []
        seen: set[str] = set()
        consecutive_errors = 0

        for i in range(min(total, limit + 15)):
            if len(competitors) >= limit:
                break
            if consecutive_errors >= 3:
                break

            try:
                # Re-query links each iteration (DOM changes after back nav)
                links = page.locator('div[role="feed"] > div > div > a')
                count = await links.count()
                if i >= count:
                    break

                aria = (
                    await links.nth(i).get_attribute("aria-label") or ""
                ).strip()
                if not aria or aria in seen:
                    continue

                # Click into the place
                log.info(f"[{i+1}/{total}] Clicking: {aria[:50]}")
                await links.nth(i).click()
                await page.wait_for_timeout(3000)
                try:
                    await page.wait_for_selector("h1", timeout=8000)
                except Exception:
                    log.warning(f"[{i+1}] No h1 found, skipping")
                    await _go_back_to_feed(page)
                    continue

                comp = await extract_place(page)
                log.info(f"[{i+1}] Extracted: {comp.name} | {comp.rating} | {comp.reviews} avis")

                if comp.name and comp.name not in seen:
                    seen.add(aria)
                    seen.add(comp.name)
                    competitors.append(comp)
                else:
                    seen.add(aria)

                # Navigate back to the feed
                if not await _go_back_to_feed(page):
                    # If we can't go back, try reloading the search
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(3000)
                    await accept_cookies(page)
                    try:
                        await page.wait_for_selector('div[role="feed"]', timeout=15000)
                    except Exception:
                        break

                consecutive_errors = 0

            except Exception as exc:
                consecutive_errors += 1
                log.error(f"[{i+1}] Error: {str(exc)[:100]}")
                try:
                    await _go_back_to_feed(page)
                except Exception:
                    pass

        return competitors
    finally:
        await context.close()
