-- Engagement démo : tracking des vues, expiration (countdown FOMO), paiement Stripe.
-- Idempotent (ré-exécutable).

-- Une ligne par session de visite ('view', heartbeat met à jour duration_seconds)
-- ou par clic sur le CTA paiement ('cta_click').
CREATE TABLE IF NOT EXISTS demo_views (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      uuid REFERENCES prospects(id) ON DELETE CASCADE,
  session_id       text UNIQUE,
  event            text NOT NULL DEFAULT 'view',     -- 'view' | 'cta_click'
  duration_seconds integer DEFAULT 0,
  user_agent       text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_views_prospect ON demo_views(prospect_id, created_at DESC);

-- Le chrono d'expiration démarre à la PREMIÈRE ouverture de la démo (pas à l'envoi du SMS).
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS demo_first_viewed_at timestamptz;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS demo_expires_at timestamptz;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Realtime (comme sms_messages). Ignore l'erreur si déjà publiée.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE demo_views;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
