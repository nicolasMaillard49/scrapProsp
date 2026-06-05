-- Ajoute source et radar_detected_at aux prospects pour le Radar.
-- Idempotent.

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source text DEFAULT 'import';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS radar_detected_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_prospects_source ON prospects(source);
CREATE INDEX IF NOT EXISTS idx_prospects_radar_detected_at ON prospects(radar_detected_at DESC);
