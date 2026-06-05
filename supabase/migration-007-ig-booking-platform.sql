-- Ajoute la colonne booking_platform aux prospects Instagram existants.
-- Idempotent : IF NOT EXISTS.

ALTER TABLE instagram_prospects
  ADD COLUMN IF NOT EXISTS booking_platform text;
