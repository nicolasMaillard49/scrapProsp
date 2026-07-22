-- Journal des réponses ENTRANTES des prospects Instagram.
--
-- Pourquoi : `ig_dm_log` ne journalise que le SORTANT. Jusqu'ici « réponse reçue »
-- était déduite du 1er M2 envoyé au prospect (la trame n'envoie jamais de M2 sans
-- réponse préalable). Ce proxy rate tout ce qui n'aboutit pas à un M2 : les refus
-- secs, les « non merci », les autorépondeurs. Cette table est la source de vérité,
-- alimentée à la main depuis le cockpit au moment où on lit la réponse.
--
-- Idempotent (ré-exécutable).

CREATE TABLE IF NOT EXISTS ig_replies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES instagram_prospects(id) ON DELETE CASCADE,
  account_id  uuid REFERENCES ig_accounts(id) ON DELETE SET NULL,
  -- positive : intéressé, pose des questions, avance dans la trame
  -- neutre   : répond sans se positionner (« c'est quoi ? », « ok »)
  -- refus    : décline explicitement
  -- autorepondeur : message automatique — ne compte PAS comme une réponse humaine
  kind        text NOT NULL CHECK (kind IN ('positive', 'neutre', 'refus', 'autorepondeur')),
  received_at timestamptz NOT NULL DEFAULT now(),
  excerpt     text,                                  -- extrait court, pour retrouver le contexte
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ig_replies_received ON ig_replies(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_replies_prospect ON ig_replies(prospect_id, received_at DESC);

-- Compteurs dénormalisés sur le prospect : le cockpit affiche « a répondu » sans
-- jointure, et la file de relance peut exclure les répondants en une condition.
ALTER TABLE instagram_prospects
  ADD COLUMN IF NOT EXISTS reply_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reply_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_ig_prospects_first_reply ON instagram_prospects(first_reply_at)
  WHERE first_reply_at IS NOT NULL;

-- Resynchronisation intégrale du prospect concerné à chaque écriture : recompter
-- coûte moins cher qu'un compteur incrémental qui dérive au premier DELETE.
-- Les autorépondeurs sont exclus — ce n'est pas un humain qui a répondu.
CREATE OR REPLACE FUNCTION sync_ig_reply_counters() RETURNS trigger AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.prospect_id, OLD.prospect_id);
  UPDATE instagram_prospects p SET
    reply_count    = (SELECT count(*)          FROM ig_replies r WHERE r.prospect_id = pid AND r.kind <> 'autorepondeur'),
    first_reply_at = (SELECT min(r.received_at) FROM ig_replies r WHERE r.prospect_id = pid AND r.kind <> 'autorepondeur'),
    last_reply_at  = (SELECT max(r.received_at) FROM ig_replies r WHERE r.prospect_id = pid AND r.kind <> 'autorepondeur')
  WHERE p.id = pid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ig_replies_sync ON ig_replies;
CREATE TRIGGER trg_ig_replies_sync
  AFTER INSERT OR UPDATE OR DELETE ON ig_replies
  FOR EACH ROW EXECUTE FUNCTION sync_ig_reply_counters();

-- Rattrape les compteurs si la table contenait déjà des lignes (ré-exécution).
UPDATE instagram_prospects p SET
  reply_count    = COALESCE(agg.n, 0),
  first_reply_at = agg.first_at,
  last_reply_at  = agg.last_at
FROM (
  SELECT prospect_id, count(*) AS n, min(received_at) AS first_at, max(received_at) AS last_at
  FROM ig_replies WHERE kind <> 'autorepondeur' GROUP BY prospect_id
) agg
WHERE p.id = agg.prospect_id;
