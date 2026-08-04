-- migration-024-ig-maps-facts.sql
--
-- La fiche Google Maps d'un prospect Instagram.
--
-- Le rapport concurrentiel (buildCompetitorReport) scrape déjà « métier ville »
-- pour classer le prospect. Le MÊME scrape rapporte, quand il le retrouve, sa
-- note, ses avis, son téléphone et son adresse — exactement la donnée qui
-- manque à sa maquette /di, et qu'aucune API Instagram ne donnera jamais.
-- On la garde donc au lieu de la jeter : un scrape, deux livrables.
--
-- Deux usages, un seul jeu de colonnes :
--   1. la maquette cesse d'afficher des chiffres factices ;
--   2. le panneau peut dire au moment d'écrire « 14e sur "coiffeur Angers",
--      3 concurrents paient des Ads » — le fait que le prospect ignore.
--
-- Toutes nullables : un prospect absent de Maps reste un prospect valide, et
-- le code retombe sur le remplissage factice.

alter table instagram_prospects
  add column if not exists maps_rank       integer,      -- position sur « métier ville » (null = absent des résultats)
  add column if not exists maps_rating     numeric(2,1), -- sa note Google
  add column if not exists maps_reviews    integer,      -- son nombre d'avis
  add column if not exists maps_phone      text,         -- le téléphone de sa fiche
  add column if not exists maps_address    text,         -- son adresse
  add column if not exists maps_ads_count  integer,      -- concurrents qui font des Google Ads
  add column if not exists maps_total      integer,      -- concurrents classés sur la requête
  add column if not exists maps_checked_at timestamptz;  -- dernier scrape (null = jamais)

-- Le refill de la sélection du jour va vouloir enrichir en priorité ceux qu'on
-- n'a jamais regardés, puis les plus anciens.
create index if not exists idx_ig_prospects_maps_checked
  on instagram_prospects (maps_checked_at nulls first);

comment on column instagram_prospects.maps_rank is
  'Position sur « métier ville » dans Google Maps. null = pas retrouvé (ce qui EST le fait à lui dire).';
comment on column instagram_prospects.maps_checked_at is
  'Date du dernier rapport concurrentiel. null = jamais scrapé ; la maquette reste alors en remplissage factice.';
