-- Colonne website sur prospects : radar.mjs et ads-scrape.mjs l'envoient déjà
-- (cleanWebsite), mais la colonne n'existait pas -> chaque INSERT échouait en 400.
-- Pour les cibles Ads, avoir le site est une info de qualification (avec/sans site).
-- Idempotent.

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS website text;
