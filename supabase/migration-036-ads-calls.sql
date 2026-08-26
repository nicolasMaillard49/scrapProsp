-- Les appels depuis les landing pages Google Ads.
--
-- POURQUOI UNE TABLE A PART, et pas une ligne de plus dans `ads_leads`.
-- Un appel n'est pas une demande de devis amputee : c'est un objet different.
-- Le visiteur ne laisse ni nom, ni message, ni numero — on ne sait qu'une
-- chose, qu'il a clique sur le numero, et avec quel gclid. On ne peut pas le
-- rappeler, on ne peut pas lui envoyer un lien de qualification. Le mettre
-- dans `ads_leads` obligerait a rendre `name`, `phone` et `message` nullables,
-- polluerait la liste que l'artisan consulte avec des lignes sur lesquelles il
-- ne peut rien faire, et casserait le parcours /q/<token>.
--
-- POURQUOI PAS LE SUIVI DES APPELS NATIF DE GOOGLE. Il exige la balise Google
-- (gtag.js) sur les pages, donc des cookies publicitaires, donc un bandeau de
-- consentement. Or la politique de confidentialite de Totowood promet noir sur
-- blanc « aucun cookie publicitaire et aucun outil de mesure d'audience
-- tiers ». On tient la promesse : le clic part vers notre propre API, comme le
-- formulaire, et la conversion est rendue a Google par l'API avec le gclid.
--
-- CE QUE CA MESURE, ET CE QUE CA NE MESURE PAS. Un clic sur le numero, pas un
-- appel decroche. Sur mobile c'est un signal d'intention tres fort — le clic
-- ouvre le composeur. Sur ordinateur c'est plus faible : le visiteur lit le
-- numero et compose sur son telephone, sans jamais cliquer. La colonne
-- `device` permet de faire la part des choses au moment de l'analyse.

CREATE TABLE IF NOT EXISTS ads_calls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_slug   text NOT NULL REFERENCES ads_clients(slug) ON DELETE RESTRICT,

  -- Le ticket de clic et les parametres ValueTrack, identiques a ads_leads
  gclid         text,
  ag            text,
  kw            text,
  mt            text,
  device        text,
  loc           text,
  camp          text,
  landing       text,                           -- la page d'ou part l'appel
  referrer      text,

  -- Ce qu'on a reussi a rendre a Google
  uploaded_at   timestamptz,
  upload_error  text,

  clicked_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_calls_client ON ads_calls(client_slug, clicked_at DESC);
-- Les appels dont la conversion n'est jamais partie : meme surveillance que
-- pour les leads, et elle doit rester instantanee.
CREATE INDEX IF NOT EXISTS idx_ads_calls_pending
  ON ads_calls(clicked_at) WHERE uploaded_at IS NULL;
-- Sert la detection du rejeu : deux clics du meme visiteur en quelques
-- secondes (il raccroche, il reclique) ne font qu'une conversion.
CREATE INDEX IF NOT EXISTS idx_ads_calls_gclid ON ads_calls(client_slug, gclid, clicked_at DESC);

-- La troisieme action de conversion du compte, a cote de « Demande de devis »
-- et « Devis signe ». Tant qu'elle est NULL, les clics s'enregistrent quand
-- meme : seul l'envoi a Google est differe. Meme regle que les deux autres.
ALTER TABLE ads_clients ADD COLUMN IF NOT EXISTS action_call text;

COMMENT ON COLUMN ads_clients.action_call IS
  'Ressource complete de l''action de conversion « Appel telephonique » : customers/<id>/conversionActions/<id>.';
