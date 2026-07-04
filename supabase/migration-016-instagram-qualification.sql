-- Qualification IA + double check automatisé des prospects Instagram.
-- (méthode prospection : tri IA par lots + activité récente + score d'opportunité)
-- Idempotent (ré-exécutable).

ALTER TABLE instagram_prospects
  ADD COLUMN IF NOT EXISTS qualification        text,        -- qualified | borderline | rejected (null = pas encore trié)
  ADD COLUMN IF NOT EXISTS qualification_reason text,        -- raison courte donnée par l'IA
  ADD COLUMN IF NOT EXISTS profession_ia        text,        -- profession détectée par l'IA
  ADD COLUMN IF NOT EXISTS last_post_at         timestamptz, -- dernier post (double check activité < 3 mois)
  ADD COLUMN IF NOT EXISTS score                integer,     -- score d'opportunité 0-100
  ADD COLUMN IF NOT EXISTS score_tier           text;        -- hot | warm | cold

-- Filtres fréquents : tri par score, sélection des non-qualifiés, des hot…
CREATE INDEX IF NOT EXISTS idx_ig_qualification ON instagram_prospects(qualification);
CREATE INDEX IF NOT EXISTS idx_ig_score         ON instagram_prospects(score DESC);
CREATE INDEX IF NOT EXISTS idx_ig_score_tier    ON instagram_prospects(score_tier);
