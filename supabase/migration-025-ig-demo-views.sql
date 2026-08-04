-- migration-025-ig-demo-views.sql
--
-- Les vues des maquettes Instagram (/di/<code>).
--
-- Table SÉPARÉE de `demo_views` — non par goût, par contrainte : `demo_views`
-- porte une clé étrangère vers `prospects` (pipeline Google Maps), et un
-- prospect Instagram vit dans `instagram_prospects`. Y insérer violerait la FK.
--
-- Pourquoi tracer : « il a ouvert sa maquette il y a 4 minutes et il est
-- encore dessus » est l'événement le plus fort de tout le tunnel, et c'était
-- le seul que le système ne voyait pas. On écrit pendant qu'il regarde.
--
-- Volontairement plus maigre que demo_views : ni expiration, ni Stripe. Une
-- maquette Instagram se montre, elle ne se vend pas toute seule.

create table if not exists ig_demo_views (
  id               uuid primary key default gen_random_uuid(),
  prospect_id      uuid references instagram_prospects(id) on delete cascade,
  session_id       text unique,          -- une ligne par session de visite
  duration_seconds integer default 0,    -- tenue à jour par les heartbeats
  user_agent       text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- La requête du radar : « qui a ouvert sa maquette récemment ».
create index if not exists idx_ig_demo_views_recent
  on ig_demo_views (created_at desc);
create index if not exists idx_ig_demo_views_prospect
  on ig_demo_views (prospect_id, created_at desc);

-- Première ouverture, gardée sur le prospect : c'est ce qui permet de dire
-- « jamais ouverte » sans jointure, et de ne notifier qu'une fois.
alter table instagram_prospects
  add column if not exists demo_first_viewed_at timestamptz,
  add column if not exists demo_last_viewed_at  timestamptz;

comment on table ig_demo_views is
  'Vues des maquettes /di. Une ligne par session ; duration_seconds monte avec les heartbeats.';
