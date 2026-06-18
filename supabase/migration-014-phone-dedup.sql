-- Empêche définitivement les doublons de prospect par TÉLÉPHONE.
--
-- Contexte : Google Maps liste un même business (déménageurs, paysagistes,
-- serruriers… « zone de service ») dans CHAQUE ville autour de sa base → même
-- nom + même téléphone, ville et maps_url différents. La contrainte UNIQUE sur
-- maps_url ne les attrapait pas. Le seul identifiant fiable est le téléphone.
--
-- On ajoute une colonne normalisée (9 derniers chiffres = forme canonique FR,
-- insensible à 0/+33/0033 et au formatage) + un index unique PARTIEL : il ne
-- s'applique qu'aux numéros valides à 9 chiffres (les valeurs courtes/vides ne
-- bloquent rien). Toute insertion d'un n° déjà présent est dès lors rejetée.

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS phone_norm text
  GENERATED ALWAYS AS (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_prospects_phone_norm
  ON prospects (phone_norm)
  WHERE char_length(phone_norm) = 9;
