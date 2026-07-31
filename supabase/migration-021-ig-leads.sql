-- File de pistes : découverte et résolution découplées.
--
-- Avant : un scan faisait tout d'un coup — hashtag PUIS profils. Avec Apify
-- c'était 2 appels ; avec les relais RapidAPI c'est 1 requête PAR profil, à
-- ~5 s pièce. Un scan de 60 comptes = 5 min, soit le maxDuration de la route :
-- l'appel mourait avant de répondre et le cockpit n'affichait rien.
--
-- Après : le hashtag ne fait qu'empiler des `ig_user_id` ici (1 requête,
-- instantané, ~30 pistes). La résolution en profils se fait ensuite par petits
-- lots bornés, qui rendent la main à chaque fois.
--
-- Idempotent (ré-exécutable).

CREATE TABLE IF NOT EXISTS ig_leads (
  ig_user_id     text PRIMARY KEY,                  -- id numérique Instagram
  hashtag_source text,                              -- hashtag qui l'a fait remonter
  metier         text,                              -- cible de chasse d'origine
  discovered_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz,                       -- NULL = encore à résoudre
  username       text,                              -- rempli à la résolution
  attempts       integer NOT NULL DEFAULT 0,        -- garde-fou anti-boucle
  last_error     text
);

COMMENT ON TABLE ig_leads IS
  'Pistes Instagram brutes (owner ids) en attente de résolution en profil. Alimentée par un scan hashtag (bon marché), consommée par lots (coûteux). Voir app/lib/igLeads.ts.';

-- Le seul accès chaud : « donne-moi le prochain lot à résoudre ».
CREATE INDEX IF NOT EXISTS idx_ig_leads_pending
  ON ig_leads (metier, discovered_at)
  WHERE resolved_at IS NULL;

-- Quota fournisseur, tel que RapidAPI le renvoie dans ses en-têtes : c'est la
-- seule source de vérité (un compteur maison dérive dès qu'un appel échoue).
ALTER TABLE ig_provider_state ADD COLUMN IF NOT EXISTS quota_limit integer;
ALTER TABLE ig_provider_state ADD COLUMN IF NOT EXISTS quota_remaining integer;
ALTER TABLE ig_provider_state ADD COLUMN IF NOT EXISTS quota_reset_at timestamptz;
