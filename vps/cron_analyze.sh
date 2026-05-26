#!/bin/bash
# Weekly cron job: batch-analyze competitors for active prospects
# Add to crontab: 0 3 * * 1  /home/scraper/cron_analyze.sh >> /home/scraper/cron.log 2>&1
#
# This calls the Next.js batch endpoint which:
# 1. Finds prospects with status "positive" or "called"
# 2. Skips those with reports less than 7 days old
# 3. Scrapes competitors via the local scraper
# 4. Stores reports in Supabase

# Your Next.js app URL (Vercel or local)
APP_URL="${APP_URL:-https://your-app.vercel.app}"

echo "$(date '+%Y-%m-%d %H:%M:%S') — Starting batch competitor analysis"

response=$(curl -s -w "\n%{http_code}" \
  -X POST "$APP_URL/api/competitor/batch" \
  -H "Content-Type: application/json" \
  -d '{"statuses":["positive","called"],"limit":10,"maxProspects":50}' \
  --max-time 3600)

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

echo "HTTP $http_code — $body"

if [ "$http_code" -ne 200 ]; then
  echo "ERROR: Batch analysis failed with HTTP $http_code"
  exit 1
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') — Batch analysis complete"
