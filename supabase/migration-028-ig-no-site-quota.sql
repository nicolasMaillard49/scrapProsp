-- migration-028-ig-no-site-quota.sql
--
-- Le plancher « sans site » de la sélection du jour.
--
-- Ce qu'on vend est un site. Un prospect qui en a déjà un, il faut le convaincre
-- de changer ; un prospect qui n'en a pas, il lui manque quelque chose. Le score
-- le sait depuis toujours (+30 quand `has_website` est faux) — la sélection du
-- jour, elle, ne regardait pas la colonne.
--
-- `no_site_min` = nombre MINIMUM de lignes sans site que la journée doit
-- contenir. Écrêté aux créneaux réels par le code : en chauffe J2 (10 créneaux),
-- un plancher de 50 vaut 10.
--
-- Pourquoi en base et pas dans le navigateur : le cron du matin construit la
-- sélection avant que l'écran ne soit ouvert. Un réglage côté client lui serait
-- invisible, et la journée serait déjà composée quand on le lirait.
--
-- Pourquoi par compte : le cockpit est multi-comptes et chaque compte a son
-- propre plan de chauffe, donc son propre nombre de créneaux.
--
-- Défaut 50 = le plafond de chauffe maximum, donc « toute la journée en
-- sans-site ». C'est le réglage demandé ; il se baisse depuis le cockpit sans
-- déploiement.
--
-- Idempotent (ré-exécutable).

alter table ig_accounts
  add column if not exists no_site_min integer not null default 50;

-- Un plancher négatif n'a pas de sens, et au-delà du plafond de chauffe il ne
-- veut rien dire de plus que « tout ». La borne haute est volontairement large
-- (100) : c'est un garde-fou de saisie, pas la règle métier — l'écrêtage aux
-- créneaux du jour se fait dans `ensureDailySelection`, qui seul connaît la
-- chauffe et les relances dues.
alter table ig_accounts
  drop constraint if exists ig_accounts_no_site_min_borne;
alter table ig_accounts
  add constraint ig_accounts_no_site_min_borne check (no_site_min between 0 and 100);
