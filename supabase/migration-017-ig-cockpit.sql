-- Cockpit de supervision multi-comptes Instagram (envoi humain, quotas, pipeline).
-- Idempotent (ré-exécutable).

-- Comptes Instagram émetteurs (prospection manuelle).
CREATE TABLE IF NOT EXISTS ig_accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username   text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'warmup',       -- warmup | chaud | pause
  started_at date NOT NULL DEFAULT CURRENT_DATE,   -- début du plan de chauffe
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Journal des messages marqués envoyés (source des quotas + stats).
CREATE TABLE IF NOT EXISTS ig_dm_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES instagram_prospects(id) ON DELETE CASCADE,
  account_id  uuid REFERENCES ig_accounts(id) ON DELETE SET NULL,
  step        text NOT NULL,                       -- M1..M9 | R1..R3
  sent_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ig_dm_log_account_sent ON ig_dm_log(account_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_dm_log_prospect     ON ig_dm_log(prospect_id, sent_at DESC);

-- Pipeline sur les prospects.
ALTER TABLE instagram_prospects
  ADD COLUMN IF NOT EXISTS contacted_by     uuid REFERENCES ig_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage            text,        -- accroche | presentation | connexion | douleur | appel_propose | questionnaire_envoye | call_booke | perdu
  ADD COLUMN IF NOT EXISTS last_dm_at       timestamptz,
  ADD COLUMN IF NOT EXISTS followup_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ig_prospects_followup ON instagram_prospects(next_followup_at)
  WHERE next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ig_prospects_stage ON instagram_prospects(stage);
