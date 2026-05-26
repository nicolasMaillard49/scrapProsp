-- Competitor analysis reports
CREATE TABLE competitor_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  ville           text NOT NULL,
  metier          text NOT NULL,
  competitors     jsonb NOT NULL DEFAULT '[]',
  ads_budget_est  numeric,
  limit_used      integer NOT NULL DEFAULT 10,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_competitor_reports_prospect ON competitor_reports(prospect_id);

ALTER PUBLICATION supabase_realtime ADD TABLE competitor_reports;
