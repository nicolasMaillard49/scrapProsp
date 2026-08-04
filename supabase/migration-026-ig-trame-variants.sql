-- migration-026-ig-trame-variants.sql
--
-- La trame qui mute : variantes d'accroche mises en concurrence.
--
-- La trame est figée depuis le premier jour, et on l'optimise à l'instinct et
-- à la mémoire de la semaine passée. Or tout est déjà journalisé : l'étape
-- envoyée (ig_dm_log), la réponse reçue (ig_replies). Il ne manquait qu'une
-- chose — savoir QUELLE formulation était partie.
--
-- Portée volontairement réduite à l'ACCROCHE (M1 / S1). C'est la seule étape
-- dont l'effet est mesurable proprement : elle part vers un prospect qui n'a
-- rien demandé, et sa première réponse est comptée une fois (réponse à froid).
-- Mettre M7 en concurrence mesurerait surtout la qualité des conversations qui
-- y arrivent, pas la formulation.

create table if not exists ig_trame_variants (
  id         uuid primary key default gen_random_uuid(),
  step       text not null,                  -- 'M1' ou 'S1'
  label      text not null,                  -- nom court, lisible dans le digest
  text       text not null,                  -- la formulation, gabarits {prenom} {metier} {lieu} compris
  active     boolean not null default true,  -- false = retirée du tirage, historique conservé
  sent       integer not null default 0,     -- accroches parties avec cette variante
  replied    integer not null default 0,     -- prospects ayant répondu ensuite
  created_at timestamptz default now()
);

create index if not exists idx_ig_trame_variants_step
  on ig_trame_variants (step, active);

-- Quelle variante est partie à ce prospect. Sans elle, une réponse arrivée
-- trois jours plus tard ne peut être créditée à personne.
alter table instagram_prospects
  add column if not exists accroche_variant uuid references ig_trame_variants(id) on delete set null;

comment on table ig_trame_variants is
  'Variantes d''accroche en concurrence (bandit epsilon-greedy). sent/replied sont les compteurs du tirage.';
comment on column instagram_prospects.accroche_variant is
  'Variante réellement envoyée à ce prospect — c''est elle qu''une réponse créditera.';
