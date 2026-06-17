-- Numéro de référence séquentiel et stable pour chaque lead d'éligibilité.
-- Affiché dans la console funnel (#1, #2, …) pour identifier un lead de façon
-- fiable, au-delà du nom/prénom. Backfill des leads existants par date de création.

ALTER TABLE eligibilite_leads ADD COLUMN IF NOT EXISTS ref bigint;

-- Backfill : numérote les lignes existantes (sans ref) par ordre de création.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST, id ASC) AS rn
  FROM eligibilite_leads
)
UPDATE eligibilite_leads e
SET ref = o.rn
FROM ordered o
WHERE e.id = o.id AND e.ref IS NULL;

-- Séquence pour les futurs leads, démarrée après le max actuel.
CREATE SEQUENCE IF NOT EXISTS eligibilite_leads_ref_seq;
SELECT setval('eligibilite_leads_ref_seq', COALESCE((SELECT MAX(ref) FROM eligibilite_leads), 0), true);
ALTER TABLE eligibilite_leads ALTER COLUMN ref SET DEFAULT nextval('eligibilite_leads_ref_seq');
ALTER SEQUENCE eligibilite_leads_ref_seq OWNED BY eligibilite_leads.ref;

ALTER TABLE eligibilite_leads ALTER COLUMN ref SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_eligibilite_leads_ref ON eligibilite_leads(ref);
