# VPS Scraper — Google Maps Competitor Intelligence

FastAPI service that scrapes Google Maps for competitors in a given city/trade.

## Local development

```bash
cd vps/scraper
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

pip install -r requirements.txt
playwright install chromium

uvicorn main:app --reload --port 8000
```

## API

**Health check**

```
GET /health
```

**Scrape competitors**

```
POST /scrape
Content-Type: application/json

{ "ville": "Limoges", "metier": "plombier", "limit": 10 }
```

Returns:

```json
{
  "competitors": [
    {
      "name": "...",
      "rating": "4,5",
      "reviews": "120",
      "phone": "05 55 ...",
      "address": "...",
      "website": "https://...",
      "maps_url": "https://www.google.com/maps/place/...",
      "category": "Plombier"
    }
  ],
  "query": "plombier Limoges",
  "ville": "Limoges",
  "metier": "plombier"
}
```

## VPS deployment

```bash
# Install dependencies
pip install -r requirements.txt
playwright install --with-deps chromium

# Run with uvicorn (production)
uvicorn main:app --host 0.0.0.0 --port 8000

# Or behind a process manager
# pip install gunicorn
# gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

Note: use a single worker (`-w 1`) since the browser instance is shared.
