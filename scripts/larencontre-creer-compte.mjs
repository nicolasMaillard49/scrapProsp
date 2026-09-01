/**
 * Cree le compte Google Ads de Restaurant La Rencontre sous le MCC.
 *
 * Identite verifiee le 01/09/2026 aux sources publiques avant creation :
 * SIREN 937 965 390, SAS, RCS Bordeaux, capital 7 000 EUR, siege 42 rue
 * Marechal Joffre 33000 Bordeaux, presidente Rosie Maillard. Le SIRET et le
 * numero de TVA transmis par la cliente concordent avec le registre.
 *
 * Ce que ce script NE fait PAS, volontairement :
 *  · il n'invite personne — l'invitation part d'un geste separe, une fois le
 *    niveau d'acces tranche (Facturation, comme pour Totowood) ;
 *  · il ne touche pas a la facturation — c'est la cliente qui saisit sa propre
 *    carte, personne d'autre.
 *
 *   node --env-file=.env.local scripts/larencontre-creer-compte.mjs        (dry)
 *   node --env-file=.env.local scripts/larencontre-creer-compte.mjs --go
 */
import { GoogleAdsApi } from "google-ads-api";

const MCC = (process.env.GOOGLE_ADS_MCC_ID || "6711813801").replace(/-/g, "");
const GO = process.argv.includes("--go");

const NOM = "Restaurant La Rencontre";
const DEVISE = "EUR";
const FUSEAU = "Europe/Paris";

const api = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});
const manager = api.Customer({
  customer_id: MCC,
  login_customer_id: MCC,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});

/* Garde-fou : ne jamais creer deux fois le meme compte. */
const existants = await manager.query(`
  SELECT customer_client.id, customer_client.descriptive_name
  FROM customer_client
`);
const doublon = existants.find(
  (l) => (l.customer_client.descriptive_name || "").toLowerCase() === NOM.toLowerCase(),
);
if (doublon) {
  console.log(
    `Un compte « ${NOM} » existe deja : ${doublon.customer_client.id}. Rien a faire.`,
  );
  process.exit(0);
}

console.log(`${existants.length} compte(s) sous le MCC ${MCC} avant creation.`);
console.log(`A creer : « ${NOM} » — ${DEVISE}, ${FUSEAU}.`);

const requete = {
  customer_id: MCC,
  customer_client: {
    descriptive_name: NOM,
    currency_code: DEVISE,
    time_zone: FUSEAU,
  },
  validate_only: !GO,
};

const res = await manager.customers.createCustomerClient(requete);

if (!GO) {
  console.log("\n--dry : rien n'a ete cree. Relancer avec --go.");
  console.log(JSON.stringify(res, null, 1).slice(0, 600));
  process.exit(0);
}

console.log("\nCree :", JSON.stringify(res, null, 1));
