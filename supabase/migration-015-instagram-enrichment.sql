-- Enrichissement des profils Instagram (pipeline hashtags petites-villes + export CSV).
-- Ajoute les champs « max d'infos » (à la IG email extractor) + le flag has_website.
-- Idempotent (ré-exécutable).

ALTER TABLE instagram_prospects
  ADD COLUMN IF NOT EXISTS email           text,
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS follows_count   integer,
  ADD COLUMN IF NOT EXISTS posts_count     integer,
  ADD COLUMN IF NOT EXISTS is_business     boolean,
  ADD COLUMN IF NOT EXISTS verified        boolean,
  ADD COLUMN IF NOT EXISTS has_website     boolean,
  ADD COLUMN IF NOT EXISTS profile_pic_url text,
  ADD COLUMN IF NOT EXISTS raw             jsonb;

-- Filtre fréquent de l'export et de la page DM (« sans site » = has_website false/null).
CREATE INDEX IF NOT EXISTS idx_ig_has_website ON instagram_prospects(has_website);
CREATE INDEX IF NOT EXISTS idx_ig_email       ON instagram_prospects(email);
