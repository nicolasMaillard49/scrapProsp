-- Reprise de scan par hashtag — un hashtag ne se jette plus, il se continue.
--
-- Avant : un hashtag scanné une fois était marqué « utilisé » et plus jamais
-- rouvert. Or #coiffeur contient 2 066 433 posts et on en lisait 30 : on jetait
-- une mine après y avoir gratté la surface, puis il fallait trouver de nouveaux
-- hashtags. Résultat au 31/07 : menuisier, paysagiste et restaurant déjà
-- « épuisés », 49 hashtags restants pour 12 métiers.
--
-- Après : on mémorise le curseur de pagination rendu par le fournisseur. Le
-- scan suivant reprend exactement là où le précédent s'est arrêté, sans jamais
-- repayer les mêmes posts. Un hashtag devient une source quasi inépuisable.
--
-- Idempotent (ré-exécutable).

CREATE TABLE IF NOT EXISTS ig_hashtag_cursors (
  hashtag      text PRIMARY KEY,
  metier       text,
  -- Curseur opaque du fournisseur : reprend la lecture après le dernier post lu.
  cursor       text,
  -- true = le fournisseur a annoncé la fin du flux ; on n'y revient plus.
  exhausted    boolean NOT NULL DEFAULT false,
  pages_done   integer NOT NULL DEFAULT 0,
  leads_found  integer NOT NULL DEFAULT 0,
  last_scan_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ig_hashtag_cursors IS
  'Point de reprise par hashtag. Permet de continuer un hashtag au lieu de le consommer une fois. Écrit par app/lib/igLeads.ts (collectLeads).';
COMMENT ON COLUMN ig_hashtag_cursors.cursor IS
  'end_cursor rendu par le fournisseur au dernier scan. NULL = repartir du début (posts les plus récents).';

-- L'accès chaud : « quel hashtag de ce métier scanner maintenant ? »
-- On veut les jamais-scannés d'abord, puis le plus anciennement scanné.
CREATE INDEX IF NOT EXISTS idx_ig_hashtag_cursors_rotation
  ON ig_hashtag_cursors (metier, last_scan_at NULLS FIRST)
  WHERE NOT exhausted;
