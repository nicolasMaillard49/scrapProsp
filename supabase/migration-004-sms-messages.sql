-- Journal des SMS (tunnel de prospection) : source de vérité unique.
-- Une ligne par SMS, sortant (blast/envoi) ou entrant (réponse).
-- Alimentée par /api/blast, /api/sms, le webhook /api/sms/incoming, et le
-- backfill Twilio (scripts/import-twilio-sms.mjs). Idempotent (ré-exécutable).

CREATE TABLE IF NOT EXISTS sms_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      uuid REFERENCES prospects(id) ON DELETE SET NULL,
  twilio_sid       text UNIQUE,                       -- dédup backfill / upsert
  direction        text NOT NULL,                     -- 'outbound' | 'inbound'
  to_phone         text,
  from_phone       text,
  body             text NOT NULL DEFAULT '',
  segments         integer,
  status           text,                              -- twilio: sent/delivered/undelivered/failed/received...
  sentiment        text,                              -- 'positive' | 'negative' | 'neutral' | NULL (à classer)
  sentiment_source text,                              -- 'ai' | 'keyword' | 'manual'
  sent_at          timestamptz,                       -- twilio dateSent/dateCreated
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_prospect  ON sms_messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sms_direction ON sms_messages(direction);
CREATE INDEX IF NOT EXISTS idx_sms_sent_at   ON sms_messages(sent_at DESC);

-- Realtime (comme prospects/calls). Ignore l'erreur si déjà publiée.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sms_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
