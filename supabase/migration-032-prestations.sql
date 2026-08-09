-- migration-032-prestations.sql
--
-- CE QU'ON A VENDU à ce client, ligne par ligne.
--
-- La description libre d'un dossier ne se compte pas : « site + une page en plus
-- + des ads » se lit très bien et ne répond à aucune des questions qui comptent
-- — combien de sites vitrine vendus ce trimestre, quel panier moyen, quelles
-- prestations reviennent. Une ligne par prestation, avec son montant, y répond.
--
-- Le CATALOGUE, lui, reste en code (`app/lib/crmServices.ts`) : ce sont les
-- offres de l'agence, elles changent au rythme d'un commit et pas d'un
-- déploiement de base. On ne stocke ici que le CODE choisi, son libellé au
-- moment de la vente (un tarif de catalogue qui bouge ne doit pas réécrire
-- l'histoire d'un dossier facturé) et le montant réellement convenu.
--
-- L'unicité (client, code) empêche la même prestation deux fois : ajouter une
-- deuxième page se dit par le MONTANT, pas par une ligne en double.
--
-- Idempotent (ré-exécutable).

create table if not exists client_services (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  -- Code du catalogue (`site-vitrine`, `campagne-ads`…). Volontairement du texte
  -- SANS contrainte : ajouter une offre = une constante TS et zéro SQL, comme
  -- pour `stage` côté prospection.
  code        text not null,
  label       text not null,
  montant_ht  numeric,
  created_at  timestamptz not null default now()
);

create unique index if not exists client_services_code_uniq
  on client_services (client_id, code);

create index if not exists client_services_client_idx
  on client_services (client_id, created_at);
