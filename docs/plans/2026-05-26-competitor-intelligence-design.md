# Local Competitor Intelligence - Design

## Objectif

Permettre d'analyser la concurrence locale d'un prospect artisan (plombier, electricien, paysagiste) en scrapant Google Maps, calculant un score GBP et estimant un budget Google Ads.

## Architecture

```
[Frontend Next.js]                    [VPS OVH 51.255.200.169]
       |                                       |
  Bouton "Analyser"                    FastAPI + Scrapling
       |                                       |
  API Route Next.js  ---- HTTP POST ---->  /scrape
  /api/competitor/analyze              Google Maps headless
       |                                       |
  Recoit resultats bruts <---- JSON ----+
       |
  Calcul scoring GBP
  Estimation budget Ads
       |
  Stocke en Supabase
  (table competitor_reports)
       |
  Retourne au frontend
       |
  Section "Concurrence"
  dans CallModal
```

## VPS - FastAPI + Scrapling

- Endpoint : `POST http://51.255.200.169:8001/scrape`
- Body : `{ "ville": "Limoges", "metier": "plombier", "limit": 10 }`
- Retourne : liste de concurrents Google Maps (nom, note, nb avis, adresse, categorie, telephone, site web, maps_url)
- Stack : Python 3, FastAPI, Uvicorn, Scrapling (Chromium headless)
- Process manager : PM2
- Pas de protection API (usage interne)

## Next.js - API Route /api/competitor/analyze

- Recoit `{ prospectId, limit }` du frontend
- Recupere le prospect en Supabase (ville + metier)
- Appelle le VPS /scrape
- Calcule le score GBP pour chaque concurrent :
  - Note Google (0-5) : ponderation 40%
  - Nb avis (log scale) : ponderation 40%
  - A un site web : ponderation 20%
- Calcule l'estimation budget Ads :
  - CPC hardcode par metier (plombier 3e, electricien 2.5e, paysagiste 2e)
  - Volume estime = nb habitants ville x coefficient metier
  - Budget mensuel = CPC x volume x CTR 3.5%
- Stocke le rapport en Supabase
- Retourne le JSON au frontend

## Supabase - Table competitor_reports

```sql
id              uuid PK DEFAULT gen_random_uuid()
prospect_id     uuid FK -> prospects(id) ON DELETE CASCADE
ville           text
metier          text
competitors     jsonb
ads_budget_est  numeric
limit_used      int
created_at      timestamptz DEFAULT now()
```

## Frontend - Section dans CallModal

- Bouton "Analyser la concurrence" avec selecteur (5 / 10 / 20, defaut 10)
- Etat loading pendant le scraping (~15-30s)
- Rapport affiche :
  - Tableau des concurrents (classes par score GBP) : nom, note, avis, site web oui/non, score
  - Position du prospect dans le classement
  - Estimation budget Ads mensuel
  - Date de l'analyse
- Cache : si rapport existant < 7 jours, afficher directement avec option "Relancer"

## CPC hardcodes

| Metier      | CPC   |
|-------------|-------|
| plombier    | 3.00  |
| electricien | 2.50  |
| paysagiste  | 2.00  |
| default     | 2.50  |

## Decisions

- Pas de NestJS : API routes Next.js suffisent
- VPS = scraper uniquement, logique metier dans Next.js
- Pas de domaine VPS, acces par IP directe
- Pas de protection API
- CPC hardcodes (pas de Google Ads API)
- Nombre de resultats configurable (5/10/20, defaut 10)
