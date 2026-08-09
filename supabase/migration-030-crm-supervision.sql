-- migration-030-crm-supervision.sql
--
-- LA SUPERVISION : ce qui vit APRÈS la livraison.
--
-- Un dossier livré n'est pas un dossier fini. Le site tourne, la campagne
-- tourne, et le client paie une maintenance tous les mois. Ce revenu-là est
-- récurrent : il ne se voit pas dans un pipeline de mission (qui, lui, se
-- termine), et l'oublier revient à travailler gratuitement sans s'en rendre
-- compte — le seul moyen de savoir qu'un mois n'a pas été payé est de le
-- COMPTER, pas de s'en souvenir.
--
-- Deux ajouts, et un seul principe : le mensuel ne se mélange jamais au forfait.
--
--  1. `clients.maintenance_ht` — le montant MENSUEL, distinct de `tarif_ht` qui
--     reste le prix de la mission. Les additionner ferait un chiffre d'affaires
--     faux dans les deux sens : un forfait compté douze fois, ou un abonnement
--     compté une seule.
--  2. `client_invoices` — une ligne par MOIS FACTURÉ, avec sa date d'échéance et
--     sa date d'encaissement. `paid_at` NULL = pas encore payé ; c'est la seule
--     source de vérité de « m'a-t-il réglé août ? ».
--
-- L'unicité (client, période) empêche le doublon d'échéance : refacturer deux
-- fois le même mois est la faute qu'un client remarque tout de suite.
--
-- Idempotent (ré-exécutable).

alter table clients add column if not exists maintenance_ht numeric;

comment on column clients.maintenance_ht is
  'Montant mensuel HT de la maintenance/supervision. Distinct de tarif_ht (prix de la mission).';

create table if not exists client_invoices (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  -- Le PREMIER jour du mois couvert : une période est un mois, pas un intervalle
  -- libre. Stocker « du 12/06 au 11/07 » rendrait « août est-il payé ? »
  -- indécidable.
  periode      date not null,
  numero       text,
  libelle      text,
  montant_ht   numeric,
  due_date     date,
  -- NULL tant que l'argent n'est pas arrivé. Une facture « payée » sans date ne
  -- permettrait pas de dire QUAND, donc pas de relancer.
  paid_at      timestamptz,
  created_at   timestamptz not null default now()
);

create unique index if not exists client_invoices_periode_uniq
  on client_invoices (client_id, periode);

create index if not exists client_invoices_client_idx
  on client_invoices (client_id, periode desc);

-- Les impayés se lisent par date d'échéance, toutes lignes confondues.
create index if not exists client_invoices_impayees_idx
  on client_invoices (due_date)
  where paid_at is null;
