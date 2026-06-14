-- Funnel d'éligibilité par prospect (clone Lokads, version test).
-- Un lead = un formulaire généré pour un prospect, envoyé par SMS,
-- rempli par le prospect, puis analysé (Claude) et relancé par email.

CREATE TABLE IF NOT EXISTS eligibilite_leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      uuid REFERENCES prospects(id) ON DELETE SET NULL,
  token            text UNIQUE NOT NULL,            -- lien court du formulaire /eligibilite/{token}

  -- Pré-rempli depuis le prospect
  metier           text,
  ville            text,

  -- Réponses du quiz
  lat              double precision,
  lon              double precision,
  radius_km        integer,
  site_url         text,
  employees_range  text,   -- solo | 2_5 | 6_15 | gt_15
  ca_range         text,   -- lt_5k | 5k_15k | 15k_50k | gt_50k
  ad_budget_range  text,   -- lt_500 | 500_1000 | 1000_3000 | gt_3000
  goal_range       text,   -- plus_30 | plus_50 | plus_100 | plus_200 | double
  first_name       text,
  last_name        text,
  email            text,
  phone            text,

  -- Analyse générée (page rapport)
  service_cible    text,
  service_reason   text,
  budget_daily     integer,    -- €/jour conseillé
  budget_monthly   integer,    -- €/mois
  calls_per_month  integer,    -- demandes estimées / mois
  revenue_month    integer,    -- CA additionnel estimé / mois

  -- État du funnel
  status           text NOT NULL DEFAULT 'created', -- created | sms_sent | submitted | report_viewed | launched
  score            integer DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  sms_sent_at      timestamptz,
  submitted_at     timestamptz,
  report_viewed_at timestamptz,
  launched_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_eligibilite_token   ON eligibilite_leads(token);
CREATE INDEX IF NOT EXISTS idx_eligibilite_status  ON eligibilite_leads(status);
CREATE INDEX IF NOT EXISTS idx_eligibilite_prospect ON eligibilite_leads(prospect_id);
