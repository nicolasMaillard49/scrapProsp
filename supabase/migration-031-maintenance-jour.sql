-- migration-031-maintenance-jour.sql
--
-- LE JOUR D'ÉCHÉANCE de la maintenance.
--
-- « Payable 30 jours après le début du mois » est une convention d'agence, pas
-- un contrat : le vrai contrat dit « le 29 de chaque mois ». Tant que la date
-- limite est calculée, chaque mois tombe un jour différent et « en retard »
-- devient une opinion — alors que c'est le seul mot qui autorise une relance.
--
-- `maintenance_day` porte donc le JOUR (1-31) convenu avec le client. Le mois
-- qui n'a pas ce jour-là (le 31 en février) est ramené à son dernier jour :
-- une échéance ne se reporte pas au mois suivant, elle se rabat sur la fin du
-- mois couvert.
--
-- Idempotent (ré-exécutable).

alter table clients add column if not exists maintenance_day smallint;

comment on column clients.maintenance_day is
  'Jour du mois (1-31) où la maintenance est due. Rabattu sur le dernier jour pour les mois plus courts.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_maintenance_day_range'
  ) then
    alter table clients
      add constraint clients_maintenance_day_range
      check (maintenance_day is null or (maintenance_day between 1 and 31));
  end if;
end $$;
