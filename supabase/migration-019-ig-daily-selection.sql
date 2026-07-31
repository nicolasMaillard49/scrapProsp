-- Sélection du jour : la liste FERMÉE des comptes à démarcher aujourd'hui.
-- Remplace la liste infinie triée à la main. Les lignes non traitées sont
-- reportées au lendemain ; on ne re-sélectionne jamais un prospect déjà servi.
-- Idempotent (ré-exécutable).

CREATE TABLE IF NOT EXISTS ig_daily_selection (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day          date NOT NULL,                                    -- jour Paris de la sélection
  account_id   uuid NOT NULL REFERENCES ig_accounts(id) ON DELETE CASCADE,
  prospect_id  uuid NOT NULL REFERENCES instagram_prospects(id) ON DELETE CASCADE,
  rank         integer NOT NULL DEFAULT 0,                       -- ordre de traitement (round-robin métier)
  first_day    date NOT NULL,                                    -- 1er jour d'entrée en sélection
  carry_count  integer NOT NULL DEFAULT 0,                       -- nb de reports depuis first_day
  done_at      timestamptz,                                      -- M1 envoyé (posé par /api/instagram/dm)
  skipped_at   timestamptz,                                      -- écarté à la main
  skip_reason  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day, account_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_ig_sel_day ON ig_daily_selection(day DESC, account_id);
-- Les lignes ENCORE ouvertes : lues à chaque génération (report) et à chaque M1.
CREATE INDEX IF NOT EXISTS idx_ig_sel_open ON ig_daily_selection(account_id, prospect_id)
  WHERE done_at IS NULL AND skipped_at IS NULL;
-- Un prospect déjà servi ne doit jamais revenir : lookup par prospect.
CREATE INDEX IF NOT EXISTS idx_ig_sel_prospect ON ig_daily_selection(prospect_id);

-- Cibles de chasse : quand le stock qualifié est épuisé, le refill relance un
-- scan hashtag sur ces métiers (round-robin sur `last_scan_at`), puis la
-- qualification IA avec l'avatar correspondant.
CREATE TABLE IF NOT EXISTS ig_hunt_targets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metier            text NOT NULL UNIQUE,            -- code métier (plombier, coiffeur…) → bibliothèque de hashtags
  avatar_profession text NOT NULL,                   -- libellé passé à l'IA de qualification
  min_followers     integer NOT NULL DEFAULT 0,
  max_followers     integer NOT NULL DEFAULT 2500,
  active            boolean NOT NULL DEFAULT true,
  last_scan_at      timestamptz,                     -- dernier refill déclenché sur ce métier
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Amorçage : les métiers déjà travaillés en base (≥ 20 prospects) deviennent
-- des cibles par défaut. Ré-exécutable, n'écrase jamais un réglage manuel.
INSERT INTO ig_hunt_targets (metier, avatar_profession)
SELECT metier, metier
FROM (
  SELECT metier, count(*) AS n
  FROM instagram_prospects
  WHERE metier IS NOT NULL AND metier <> ''
  GROUP BY metier
  HAVING count(*) >= 20
) t
ON CONFLICT (metier) DO NOTHING;
