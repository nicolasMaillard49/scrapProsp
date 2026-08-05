-- migration-027-ig-dm-log-unicite.sql
--
-- Un envoi ne s'inscrit qu'une fois.
--
-- Le 05/08, le compteur du jour annonçait 75 accroches. La base contenait bien
-- 75 lignes M1 — pour 49 prospects distincts. 26 doublons, tous insérés dans la
-- même seconde, un prospect comptant même trois lignes.
--
-- Cause : trois chemins journalisent le même message (détection d'envoi après
-- « Insérer », auto-détection du champ vidé, bouton « Envoyé » du panneau), et
-- leur seul garde-fou vivait dans l'extension — un `sentKeys` lu AVANT l'appel
-- réseau et écrit APRÈS. Deux détections simultanées le franchissaient toutes
-- les deux, et l'API insérait sans condition.
--
-- Un garde-fou applicatif ne suffit pas : deux requêtes concurrentes peuvent
-- toujours lire « pas de ligne » en même temps. Seule la base tranche. D'où la
-- clé d'unicité (prospect, étape, jour civil Paris) — exactement l'invariant que
-- l'extension essayait déjà d'exprimer.
--
-- Pourquoi une COLONNE `sent_day` et pas un index sur une expression : la
-- conversion d'un timestamptz vers un fuseau nommé est STABLE, pas IMMUTABLE,
-- donc inindexable. Le jour est donc matérialisé à l'écriture.

-- 1. Le jour civil Paris de l'envoi, matérialisé.
alter table ig_dm_log
  add column if not exists sent_day date;

-- Rattrape l'historique. `at time zone` sur un timestamptz rend l'heure locale
-- du fuseau, changement d'heure compris.
update ig_dm_log
   set sent_day = (sent_at at time zone 'Europe/Paris')::date
 where sent_day is null;

alter table ig_dm_log
  alter column sent_day set default ((now() at time zone 'Europe/Paris')::date);

alter table ig_dm_log
  alter column sent_day set not null;

-- 2. Purge les doublons déjà inscrits — on garde la PREMIÈRE ligne de chaque
--    (prospect, étape, jour), celle qui correspond au message réellement parti ;
--    les suivantes sont les détections en double.
--    Les lignes sans prospect sont laissées telles quelles : elles ne sont
--    rattachables à rien, donc pas dédoublonnables.
delete from ig_dm_log a
 using ig_dm_log b
 where a.prospect_id is not null
   and a.prospect_id = b.prospect_id
   and a.step        = b.step
   and a.sent_day    = b.sent_day
   and (a.sent_at, a.id) > (b.sent_at, b.id);

-- 3. La règle, désormais tenue par la base.
create unique index if not exists ig_dm_log_unique_envoi
  on ig_dm_log (prospect_id, step, sent_day)
  where prospect_id is not null;

-- Le compteur du jour et les KPI lisent sur (sent_day, step) : autant l'indexer.
create index if not exists idx_ig_dm_log_day_step
  on ig_dm_log (sent_day, step);
