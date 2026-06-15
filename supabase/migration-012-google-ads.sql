-- Suivi des comptes/campagnes Google Ads créés automatiquement depuis le funnel.
-- Un lead "launched" → un compte client sous le MCC 671 + une campagne Search.
-- En dry-run : ligne status='dry_run' avec le payload complet, sans customer_id.

CREATE TABLE IF NOT EXISTS google_ads_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid REFERENCES eligibilite_leads(id) ON DELETE SET NULL,
  client_name  text NOT NULL,
  customer_id  text,            -- compte client créé sous le MCC 671 (sans tirets)
  mcc_id       text NOT NULL DEFAULT '6711813801',
  campaign_id  text,
  budget_id    text,
  status       text DEFAULT 'pending', -- pending | dry_run | paused | active | capped | error
  daily_budget integer,         -- €/jour
  metier       text,
  ville        text,
  payload      jsonb,           -- dump du dry-run (mapping + keywords + RSA)
  error        text,
  created_at   timestamptz DEFAULT now(),
  activated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_google_ads_lead   ON google_ads_accounts(lead_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_status ON google_ads_accounts(status);
