# VPS Scraper — Google Maps Competitor Intelligence

FastAPI service that scrapes Google Maps for competitors in a given city/trade.
Runs on VPS OVH (51.255.200.169:8001).

## Local development

```bash
cd vps/scraper
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

pip install -r requirements.txt
playwright install chromium

uvicorn main:app --reload --port 8001
```

Test:

```bash
curl -X POST http://localhost:8001/scrape \
  -H "Content-Type: application/json" \
  -d '{"ville":"Limoges","metier":"plombier","limit":3}'
```

## API

**Health check**

```
GET /health  ->  {"status": "ok"}
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

## VPS deployment (SSH)

### 1. Install system dependencies

```bash
ssh root@51.255.200.169

apt update && apt install -y python3 python3-venv python3-pip

# Install Node.js 20 + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

### 2. Setup scraper

```bash
mkdir -p /opt/scrapprosp-scraper
cd /opt/scrapprosp-scraper

# Upload files from local machine (run from your PC):
# scp vps/scraper/main.py vps/scraper/requirements.txt root@51.255.200.169:/opt/scrapprosp-scraper/

# On VPS:
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install --with-deps chromium
```

### 3. Test manually

```bash
cd /opt/scrapprosp-scraper
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001
# Ctrl+C to stop
```

### 4. Setup PM2 (auto-restart)

```bash
pm2 start "/opt/scrapprosp-scraper/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001" \
  --name scraper \
  --cwd /opt/scrapprosp-scraper

pm2 save
pm2 startup  # auto-start on reboot
```

### 5. Open port (if firewall active)

```bash
ufw allow 8001/tcp
```

### 6. Verify from local machine

```bash
curl http://51.255.200.169:8001/health
# -> {"status": "ok"}
```

## Notes

- Single worker only (`-w 1`) — the browser instance is shared
- Timeout: 120 seconds per request
- No auth — the endpoint is open
