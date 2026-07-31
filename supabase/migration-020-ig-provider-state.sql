-- Chaîne de sources Instagram : Apify primaire, relais RapidAPI en secours.
--
-- Deux besoins, deux objets :
--  1. `instagram_prospects.ig_user_id` — les feeds hashtag RapidAPI ne renvoient
--     que l'id numérique du compte, jamais le username. Sans cet index, chaque
--     scan repaierait une requête par compte déjà en base juste pour réapprendre
--     son pseudo, et brûlerait le quota gratuit en un seul passage.
--  2. `ig_provider_state` — mémoire des pannes. Sur Vercel chaque hashtag est une
--     invocation distincte : sans état partagé, un scan de 25 hashtags retaperait
--     25 fois une source déjà épuisée.
--
-- Idempotent (ré-exécutable).

ALTER TABLE instagram_prospects ADD COLUMN IF NOT EXISTS ig_user_id text;

COMMENT ON COLUMN instagram_prospects.ig_user_id IS
  'Id numérique Instagram du compte. Renseigné quand la source le fournit ; sert à dédupliquer les feeds hashtag RapidAPI qui ne donnent pas le username.';

-- Partiel : la colonne reste vide sur tout l'historique scrapé avant la bascule.
CREATE INDEX IF NOT EXISTS idx_ig_prospects_ig_user_id
  ON instagram_prospects (ig_user_id)
  WHERE ig_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ig_provider_state (
  provider       text PRIMARY KEY,               -- 'apify' | 'looter' | 'stable'
  disabled_until timestamptz,                    -- NULL = disponible
  last_kind      text,                           -- quota | auth | rate_limit | transient | fatal
  last_error     text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ig_provider_state IS
  'Providers de scraping Instagram momentanément écartés (quota épuisé, panne). Écrit par app/lib/igProviders/state.ts.';
