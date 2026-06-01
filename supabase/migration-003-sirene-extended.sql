-- Champs SIRENE élargis sur prospects (dirigeant, effectif, géo, RGE, juridique).
-- Source : recherche-entreprises.api.gouv.fr (cf. scripts/enrich-sirene.mjs).
-- Idempotent : ré-exécutable sans erreur.

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS dirigeant_nom               text,
  ADD COLUMN IF NOT EXISTS dirigeant_prenom            text,
  ADD COLUMN IF NOT EXISTS dirigeant_annee_naissance   integer,
  ADD COLUMN IF NOT EXISTS tranche_effectif            text,
  ADD COLUMN IF NOT EXISTS effectif_label              text,
  ADD COLUMN IF NOT EXISTS latitude                    numeric,
  ADD COLUMN IF NOT EXISTS longitude                   numeric,
  ADD COLUMN IF NOT EXISTS est_rge                     boolean,
  ADD COLUMN IF NOT EXISTS nature_juridique            text,
  ADD COLUMN IF NOT EXISTS categorie                   text;

-- Filtre fréquent : prospects RGE.
CREATE INDEX IF NOT EXISTS idx_prospects_est_rge ON prospects(est_rge);
