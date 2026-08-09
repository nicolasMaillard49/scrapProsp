-- migration-029-crm-clients.sql
--
-- Le CRM : un DOSSIER par client, là où le reste de l'app suit des PROSPECTS.
--
-- Pourquoi une table à part et pas des colonnes de plus sur `instagram_prospects` :
--
--  1. Tous les clients ne viennent pas d'Instagram. Un client démarché par
--     audit, par recommandation ou en direct n'a pas de pseudo IG — l'inscrire
--     dans `instagram_prospects` en ferait un faux prospect, qui polluerait la
--     sélection du jour, le taux de réponse et les KPI de prospection.
--  2. Un prospect et un client ne vivent pas au même rythme. Le prospect a un
--     STADE de tunnel (accroche → call booké) qui se ferme ; le client a un
--     AVANCEMENT DE MISSION qui commence là où le tunnel s'arrête.
--
-- Le lien reste possible, jamais obligatoire : `instagram_prospect_id` rattache
-- le dossier au prospect quand il en vient (on récupère alors pseudo, métier,
-- ville, maquette et historique DM sans les recopier). `ON DELETE SET NULL` :
-- supprimer un prospect ne doit jamais emporter un dossier client — l'argent
-- encaissé survit à un nettoyage de base de prospection.
--
-- Idempotent (ré-exécutable).

-- ── Le dossier ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom          text NOT NULL,                    -- raison sociale ou nom d'usage
  contact      text,                             -- l'interlocuteur (prénom, rôle)
  email        text,
  telephone    text,
  site_url     text,                             -- son site actuel (ou celui qu'on lui a livré)
  image_url    text,                             -- logo / photo — une URL, pas un fichier stocké
  metier       text,                             -- même vocabulaire que `instagram_prospects.metier`
  ville        text,
  description  text NOT NULL DEFAULT '',         -- le contexte, en clair — ce qu'aucune colonne ne dira
  statut       text NOT NULL DEFAULT 'piste',    -- cf. CLIENT_STATUSES (app/lib/crm.ts)
  source       text,                             -- 'instagram' | 'audit' | 'recommandation' | 'direct' | …
  -- Le tarif ANNONCÉ, en euros HT. `numeric` et non un entier de centimes :
  -- le catalogue de l'agence est en euros ronds (300 / 500 € HT) et cette
  -- valeur se lit à l'écran bien plus souvent qu'elle ne se calcule.
  tarif_ht     numeric(10,2),
  recurrent    boolean NOT NULL DEFAULT false,   -- abonnement mensuel vs mission one-shot
  started_at   date,                             -- début de mission
  closed_at    date,                             -- clôture (livré / terminé / perdu)
  instagram_prospect_id uuid REFERENCES instagram_prospects(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Un prospect IG ne donne qu'UN dossier : sans ça, deux imports successifs
-- créent deux fiches pour le même client et la progression se dédouble.
-- Index partiel : les dossiers sans origine IG (la majorité, à terme) ne
-- s'entre-bloquent pas sur un `NULL`.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_ig_prospect
  ON clients(instagram_prospect_id) WHERE instagram_prospect_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_statut ON clients(statut);
CREATE INDEX IF NOT EXISTS idx_clients_created ON clients(created_at DESC);

-- Le statut est libre en base (comme `instagram_prospects.stage`, migration 017) :
-- ajouter une étape de cycle de vie = 2 constantes TypeScript et zéro SQL.
-- La validation vit dans `parseClientStatus()`, seul point d'entrée d'écriture.

-- ── La checklist de mission ─────────────────────────────────────────────────
-- Une ligne = une étape cochable. `rank` porte l'ordre : la checklist se lit
-- dans l'ordre où le travail se fait, pas dans l'ordre où on l'a tapée.
CREATE TABLE IF NOT EXISTS client_tasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label      text NOT NULL,
  details    text,                               -- précisions libres (specs, liens)
  phase      text,                               -- regroupement optionnel : « Cadrage », « Production »…
  rank       integer NOT NULL DEFAULT 0,
  done       boolean NOT NULL DEFAULT false,
  done_at    timestamptz,                        -- posé/effacé par l'API, jamais à la main
  due_date   date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_tasks_client ON client_tasks(client_id, rank);
-- Le compteur « reste à faire », lu sur la liste des dossiers.
CREATE INDEX IF NOT EXISTS idx_client_tasks_open ON client_tasks(client_id) WHERE done = false;

-- ── Le journal ──────────────────────────────────────────────────────────────
-- Ce qui s'est dit et quand. Séparé de `clients.description` : la description
-- est l'état COURANT du dossier (elle se réécrit), le journal est son HISTOIRE
-- (il s'empile et ne se réécrit pas).
CREATE TABLE IF NOT EXISTS client_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  body       text NOT NULL,
  kind       text NOT NULL DEFAULT 'note',       -- note | appel | email | reunion | livraison | paiement
  at         timestamptz NOT NULL DEFAULT now(), -- quand ça s'est passé (≠ quand on l'a écrit)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(client_id, at DESC);

-- ── updated_at automatique ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_clients() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_clients();
