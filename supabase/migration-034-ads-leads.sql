-- Demandes de devis venues des landing pages Google Ads (projet totowood-lp et
-- les suivants). Deux tables : la configuration du compte Ads d'un client, et
-- les leads eux-mêmes.
--
-- Le circuit : la landing page capte le gclid, poste sur /api/leads, la ligne
-- s'écrit ici. Plus tard l'artisan ouvre /q/<token>, dit « signé, 4 200 € », et
-- on renvoie la conversion à Google avec sa valeur.

-- ── Un client = un compte Google Ads = deux actions de conversion ────────────
-- Les deux `conversion_action` sont des identifiants de RESSOURCE complets, de
-- la forme customers/1234567890/conversionActions/987654321. C'est eux que
-- l'API cite, jamais le libellé affiché dans l'interface.
CREATE TABLE IF NOT EXISTS ads_clients (
  slug              text PRIMARY KEY,           -- 'totowood'
  label             text NOT NULL,              -- 'Totowood'
  customer_id       text,                       -- compte Ads, sans tirets
  action_request    text,                       -- « Demande de devis »
  action_sale       text,                       -- « Devis signé »
  notify_email      text,                       -- l'artisan, pour la notification
  notify_telegram   boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Les demandes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ads_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_slug   text NOT NULL REFERENCES ads_clients(slug) ON DELETE RESTRICT,

  -- Ce que le visiteur a écrit
  name          text NOT NULL,
  phone         text NOT NULL,                  -- normalisé +33…
  email         text,
  commune       text,
  message       text NOT NULL,
  service       text,                           -- le groupe d'annonces

  -- Le ticket de clic et les paramètres ValueTrack du modèle de suivi
  gclid         text,
  ag            text,                           -- adgroupid
  kw            text,                           -- keyword
  mt            text,                           -- matchtype
  device        text,
  loc           text,                           -- loc_physical_ms
  camp          text,                           -- campaignid
  landing       text,                           -- la route d'où vient la demande
  referrer      text,

  -- Qualification par l'artisan
  token         text NOT NULL UNIQUE,           -- porte le lien /q/<token>
  status        text NOT NULL DEFAULT 'nouveau', -- nouveau | signe | perdu
  amount_cents  bigint,                         -- montant du chantier, en centimes
  qualified_at  timestamptz,

  -- Ce qu'on a réussi à renvoyer à Google
  request_uploaded_at timestamptz,              -- « Demande de devis », à J0
  sale_uploaded_at    timestamptz,              -- « Devis signé », à la qualification
  sale_amount_cents   bigint,                   -- valeur réellement envoyée, pour détecter une correction
  upload_error        text,

  received_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_leads_client   ON ads_leads(client_slug, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_leads_status   ON ads_leads(status);
CREATE INDEX IF NOT EXISTS idx_ads_leads_token    ON ads_leads(token);
-- Les leads dont la conversion n'est jamais partie : c'est cette requête que
-- surveille la relance, et elle doit rester instantanée.
CREATE INDEX IF NOT EXISTS idx_ads_leads_pending
  ON ads_leads(received_at) WHERE request_uploaded_at IS NULL;

-- Anti-doublon : le double-clic et le retour arrière renvoient le même
-- formulaire deux fois de suite. La détection se fait dans la route, sur une
-- fenêtre de quelques minutes — un index unique par tranche horaire refuserait
-- aussi la deuxième demande, légitime, d'un client qui rappelle vingt minutes
-- plus tard. Cet index sert la recherche du rejeu, pas son interdiction.
CREATE INDEX IF NOT EXISTS idx_ads_leads_rejeu
  ON ads_leads(client_slug, phone, received_at DESC);

-- Le client du jour. customer_id et les deux actions restent NULL tant que le
-- compte Ads n'est pas monté — la route l'accepte et enregistre quand même le
-- lead, elle diffère seulement l'envoi à Google.
INSERT INTO ads_clients (slug, label, notify_email)
VALUES ('totowood', 'Totowood', NULL)
ON CONFLICT (slug) DO NOTHING;
