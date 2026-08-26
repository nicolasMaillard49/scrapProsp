-- Notification par SMS de l'artisan à chaque demande de devis.
--
-- Pourquoi une troisieme voie, alors que Telegram et l'e-mail existent deja :
-- Telegram va a l'agence, pas au client, et un menuisier dans son atelier avec
-- la scie qui tourne ne lit pas ses mails. Il sent son telephone vibrer. Le
-- delai de rappel est ce qui decide un devis face a un concurrent : quelques
-- centimes par lead pour rappeler dans les dix minutes au lieu du soir.
--
-- La colonne porte le numero, pas un booleen : NULL = pas de SMS pour ce
-- client. Un seul champ, un seul etat a lire, aucune combinaison absurde du
-- genre « active mais sans numero ».
--
-- Format attendu : E.164, +33XXXXXXXXX. `toE164()` (app/lib/sms.ts) refuse les
-- fixes, la VoIP et les numeros speciaux, qui ne recoivent pas de SMS. Un
-- numero d'atelier en 01 sera donc silencieusement ignore a l'envoi : c'est
-- voulu, on ne facture pas un SMS qui n'arrivera jamais.

ALTER TABLE ads_clients ADD COLUMN IF NOT EXISTS notify_sms text;

COMMENT ON COLUMN ads_clients.notify_sms IS
  'Mobile de l''artisan en E.164 (+33...), notifie a chaque lead. NULL = pas de SMS.';
