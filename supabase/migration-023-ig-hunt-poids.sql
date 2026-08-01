-- Tourniquet de chasse PONDÉRÉ.
--
-- Le refill sert une seule cible par tour, et une collecte coûte une requête de
-- quota qu'elle ramène 30 comptes ou 10. La seule façon de donner plus de volume
-- à un métier est donc de le faire passer plus souvent — pas d'en prendre plus
-- à chaque passage.
--
-- Sans pondération, les 14 professions libérales déclarées le 31/07 (456531a)
-- faisaient passer les artisans de 1 tour sur 12 à 1 tour sur 26 : on divisait
-- par deux la cadence de ce dont le rendement est établi (~43 % de retenus sur
-- menuisier) au profit de niches non mesurées — le seul scan de kiné n'a donné
-- qu'un retenu sur 6 profils résolus, échantillon trop mince pour conclure.
--
-- Le refill sert la cible dont le rapport `scans / poids` est le plus bas : à
-- poids 3 contre 1, un métier passe exactement trois fois plus souvent, quelle
-- que soit la fréquence des refills. Ajuster = un UPDATE, sans toucher au code.
--
-- Un premier réglage fondé sur un délai de réserve (poids 3 = repasse après 8 h
-- au lieu de 24 h) a été mesuré puis jeté : dès que les refills sont plus
-- espacés que le délai, toutes les cibles sont en retard et le tri retombe sur
-- du tour-par-tour — 40 % pour les artisans au lieu des 65 % visés. Compter les
-- passages est insensible à la cadence, c'est pour ça que `scans` existe.

ALTER TABLE ig_hunt_targets ADD COLUMN IF NOT EXISTS poids integer NOT NULL DEFAULT 1;
ALTER TABLE ig_hunt_targets ADD COLUMN IF NOT EXISTS scans integer NOT NULL DEFAULT 0;

-- Un poids nul ou négatif ferait une division par zéro côté refill : on cadre.
ALTER TABLE ig_hunt_targets DROP CONSTRAINT IF EXISTS ig_hunt_targets_poids_ck;
ALTER TABLE ig_hunt_targets ADD CONSTRAINT ig_hunt_targets_poids_ck CHECK (poids BETWEEN 1 AND 10);

-- Les artisans du bâtiment : rendement prouvé, ils gardent le gros du volume.
-- `estheticienne` et `restaurant` restent à 1 — la première est un test d'avatar
-- (segment beauté), le second un résidu de l'annuaire Bordeaux.
UPDATE ig_hunt_targets SET poids = 3
WHERE metier IN (
  'plombier', 'electricien', 'chauffagiste', 'macon', 'menuisier',
  'carreleur', 'couvreur', 'peintre', 'ferronnier', 'paysagiste'
);
