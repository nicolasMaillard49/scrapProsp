# Design — Radar de nouveaux prospects

> Date : 2026-06-05
> Statut : valide par l'utilisateur

## Objectif

Cron quotidien (3h) qui scrape automatiquement Google Maps par region/metier, detecte les nouvelles fiches absentes de la base Supabase, les insere automatiquement, et envoie un SMS recap a l'admin (0615907873).

## Architecture

```
VPS cron (3h) → POST /api/cron/radar (Next.js)
    → Lit les regions + metiers actifs depuis prospects
    → Pour chaque combo (metier, region) : scrape les villes de la region
    → Compare vs prospects existants (dedup par maps_url)
    → Insere les nouveaux (status "todo", source "radar")
    → Si >= 1 nouveau : envoie 1 SMS recap admin
```

## Schema DB

Migration 008 — colonnes sur `prospects` :
- `source text DEFAULT 'import'` — 'import' | 'radar' | 'carte'
- `radar_detected_at timestamptz` — timestamp de detection (null pour les anciens)

Backfill existants : source = 'import', radar_detected_at = NULL.
Prospects ajoutes depuis /carte : source = 'carte'.

## Endpoint `/api/cron/radar`

- Route : `POST /api/cron/radar`
- Auth : `x-cron-secret` == `CRON_SECRET`
- Exempte dans middleware.ts
- Logique :
  1. `SELECT DISTINCT metier, region FROM prospects` → combos actifs
  2. Pour chaque combo, iterer sur REGION_CITIES[region]
  3. Appeler `SCRAPER_URL/scrape` { ville, metier, limit: 20, quick: true }
  4. Filtrer : garder ceux sans website (ou website invalide)
  5. Dedup : exclure ceux dont maps_url existe deja en base
  6. Insert batch dans prospects (source='radar', radar_detected_at=now(), status='todo')
  7. Accumuler le total par metier/region
  8. Si total > 0 : envoyer 1 SMS via Twilio au 0615907873

## Map REGION_CITIES

Fichier `app/lib/regionCities.ts` — ~10-15 villes par region (prefectures + sous-prefectures + villes moyennes). Si une region n'est pas dans la map, on skip.

## SMS recap

Format : "Radar: {N} nouveaux prospects ({detail par metier/region}). Ouvre l'app pour les voir."
Destinataire : 0615907873 (hardcode ou env var RADAR_ADMIN_PHONE)
Un seul SMS par nuit, uniquement si nouveaux > 0.

## Frontend

- Filtre "Radar" dans la barre de filtres (page principale)
- Tri par radar_detected_at DESC dans le dropdown
- Badge visuel "Nouveau" sur les prospects avec radar_detected_at < 48h

## Cron VPS

```bash
0 3 * * * curl -s -X POST $APP_URL/api/cron/radar -H "x-cron-secret: $CRON_SECRET" >> /var/log/radar-cron.log 2>&1
```

## Estimation effort

- Migration DB : 15 min
- regionCities.ts : 30 min
- /api/cron/radar : 1-2h
- Frontend (filtre + badge) : 1h
- Cron setup VPS : 15 min
- Total : ~4h

## Securite

- Endpoint protege par CRON_SECRET
- Exempte du middleware auth (comme run-blasts)
- Pas de donnees sensibles exposees
