-- migration-033-documents.sql
--
-- LES PIÈCES du dossier : audits PDF, devis, captures, logo du client.
--
-- Un audit vit aujourd'hui dans `D:\projets\audit\<client>\output\pdf\` — c'est
-- à dire nulle part pour qui ouvre le dossier client. Le rapport qu'on a mis
-- deux heures à produire doit être à UN clic de la fiche, sinon il est refait,
-- ou pire, une version périmée est renvoyée au client.
--
-- Le FICHIER va dans Supabase Storage (bucket `crm`), la BASE ne garde que le
-- chemin, le nom d'origine et la taille : mettre des octets dans Postgres rend
-- chaque `select` du dossier lourd pour un contenu qu'on n'affiche presque
-- jamais.
--
-- Le bucket est PRIVÉ. Un audit nomme des chiffres d'affaires, des faiblesses
-- de site et des budgets : une URL publique devinable suffirait à l'exposer.
-- Les liens sont donc signés à la lecture, et expirent.
--
-- Idempotent (ré-exécutable).

create table if not exists client_documents (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  -- Chemin DANS le bucket (`<client_id>/<uuid>.pdf`). Le fichier lui-même n'est
  -- pas ici : voir Supabase Storage, bucket `crm`.
  path        text not null,
  nom         text not null,
  mime        text,
  taille      bigint,
  -- `audit`, `devis`, `facture`, `image`, `autre` — libre, comme `stage` :
  -- ajouter un genre = une constante TS et zéro SQL.
  kind        text not null default 'autre',
  created_at  timestamptz not null default now()
);

create index if not exists client_documents_client_idx
  on client_documents (client_id, created_at desc);

create unique index if not exists client_documents_path_uniq
  on client_documents (path);
