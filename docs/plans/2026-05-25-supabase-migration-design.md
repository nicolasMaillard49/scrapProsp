# Design : Migration Supabase - prospects-tracker

> Date : 2026-05-25
> Statut : Approuve

## Contexte

L'app prospects-tracker stocke tout l'etat de prospection dans `localStorage`. Objectif : migrer vers Supabase pour avoir un vrai historique persistant, multi-device, avec synchronisation temps reel.

## Decisions

| Decision | Choix |
|----------|-------|
| Backend | Supabase (free tier suffisant) |
| Approche | Client Supabase direct dans React (pas de proxy API routes) |
| Donnees | Tout en base (prospects + etat + historique) + import CSV conserve |
| Auth | Garder le systeme actuel (cookie + mot de passe partage) |
| Realtime | Supabase Realtime (postgres_changes) |

## Schema de base de donnees

### Table `prospects`

Fusionne les donnees CSV (ex-Prospect) et l'etat de prospection (ex-ProspectState).

```sql
CREATE TABLE prospects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  metier          text,
  phone           text NOT NULL,
  ville           text,
  departement     text,
  region          text,
  region_label    text,
  rating          numeric,
  reviews         integer,
  hours_status    text,
  address         text,
  maps_url        text UNIQUE,
  siret           text,
  company_created_at date,
  age_years       numeric,
  legal_status    text,
  naf_code        text,
  status          text NOT NULL DEFAULT 'todo',
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_prospects_status ON prospects(status);
```

### Table `calls`

Historique d'appels normalise (1 ligne = 1 appel).

```sql
CREATE TABLE calls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  called_at   timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL,
  duration    integer,
  note        text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_calls_prospect ON calls(prospect_id);
```

### Volume estime

- `prospects` : ~500 lignes, quelques milliers a terme
- `calls` : ~3K-7K/an (5-20 appels/jour)

## Architecture cote app

### Nouveaux fichiers

- `app/lib/supabase.ts` : client Supabase singleton (anon key depuis env)
- `app/lib/useProspects.ts` : hook React — fetch initial + subscription realtime sur `prospects`
- `app/lib/useCalls.ts` : hook React — historique par prospect + subscription realtime sur `calls`

### Fichiers modifies

- `app/lib/types.ts` : types alignes sur le schema DB (Prospect = row DB, plus de ProspectState separe)
- `app/page.tsx` : remplacer localStorage par hooks Supabase, supprimer chargement CSV/manifest
- `app/components/CallModal.tsx` : insert dans `calls` au lieu de push dans array, supprimer ntfy localStorage

### Fichiers supprimes

- `app/api/snapshot/route.ts` : plus besoin (DB = source de verite)
- `public/state-seed.json` : idem
- `public/manifest.json` : regions depuis DB
- `public/prospects-*.csv` : donnees migrees en base (conserves temporairement pour migration)

### Flux de donnees

1. Chargement : `supabase.from('prospects').select('*, calls(*)')` — jointure en 1 requete
2. Mise a jour statut : `supabase.from('prospects').update({ status, updated_at })`
3. Enregistrer appel : `supabase.from('calls').insert(...)` + update `prospects.status`
4. Realtime : subscriptions sur `prospects` et `calls`, maj du state React local
5. Import CSV : `supabase.from('prospects').upsert(rows, { onConflict: 'maps_url' })`

### Ce qui reste identique

- Auth cookie + middleware
- UI/UX (filtres, focus mode, call modal, raccourcis clavier)
- Logique de filtrage/tri cote client (~500 prospects en memoire)

## Migration des donnees

Script one-shot pour :
1. Parser les 4 CSV regionaux
2. Inserer les prospects dans Supabase
3. Migrer le localStorage existant (statuts + historique) en base

## Variables d'environnement

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
