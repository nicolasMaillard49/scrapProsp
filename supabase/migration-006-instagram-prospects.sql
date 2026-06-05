-- Prospects découverts sur Instagram (canal de découverte distinct de Google Maps).
-- Alimentée par /api/instagram/discover (Apify : hashtag-scraper + profile-scraper),
-- après filtre « pas de site web ». Une ligne par compte. Idempotent (ré-exécutable).

CREATE TABLE IF NOT EXISTS instagram_prospects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username       text UNIQUE NOT NULL,              -- handle Instagram (sans @) — clé de dédup
  full_name      text,
  bio            text,
  external_url   text,                              -- lien du profil (sert au filtre ; conservé pour audit)
  followers      integer,
  category       text,                              -- businessCategoryName Instagram si dispo
  metier         text,                              -- code métier déduit (→ template d'aperçu)
  ville          text,                              -- ville déduite (hashtag/bio)
  hashtag_source text,                              -- hashtag qui a remonté le compte (traçabilité)
  status         text NOT NULL DEFAULT 'todo',      -- 'todo' | 'contacted' | 'positive' | 'negative'
  notes          text NOT NULL DEFAULT '',
  discovered_at  timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ig_status         ON instagram_prospects(status);
CREATE INDEX IF NOT EXISTS idx_ig_hashtag_source ON instagram_prospects(hashtag_source);
CREATE INDEX IF NOT EXISTS idx_ig_discovered_at  ON instagram_prospects(discovered_at DESC);

-- updated_at auto (trigger générique).
CREATE OR REPLACE FUNCTION set_updated_at_instagram() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ig_updated_at ON instagram_prospects;
CREATE TRIGGER trg_ig_updated_at
  BEFORE UPDATE ON instagram_prospects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_instagram();

-- Realtime (comme prospects/sms_messages). Ignore l'erreur si déjà publiée.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE instagram_prospects;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
