-- Prospects table: combines CSV data + prospection state
CREATE TABLE prospects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  metier          text,
  phone           text NOT NULL,
  ville           text,
  departement     text,
  region          text,
  region_label    text,
  rating          numeric,
  reviews         integer,
  hours_status    text,
  address         text,
  maps_url        text UNIQUE,
  siret           text,
  company_created_at date,
  age_years       numeric,
  legal_status    text,
  naf_code        text,
  -- Prospection state (formerly in localStorage)
  status          text NOT NULL DEFAULT 'todo',
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_region ON prospects(region);

-- Call history: one row per call
CREATE TABLE calls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  called_at   timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL,
  duration    integer,
  note        text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_calls_prospect ON calls(prospect_id);
CREATE INDEX idx_calls_called_at ON calls(called_at DESC);

-- Auto-update updated_at on prospects
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE prospects;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
