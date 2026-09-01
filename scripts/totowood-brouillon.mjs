/**
 * Supprime le brouillon résiduel « Campaign #1 » du compte Totowood.
 *
 * Ce brouillon est le résidu de l'assistant de création du compte : il porte
 * un budget de 1 €/jour, ne diffuse pas, et fausse deux choses — la
 * recommandation « Il manque des liens annexes dans 1 campagne », qui ne vise
 * pas notre campagne, et le compteur de campagnes du compte.
 *
 * La suppression est IRRÉVERSIBLE côté Google : une campagne REMOVED ne se
 * rouvre pas. D'où le --dry par défaut, et le refus de toucher à autre chose
 * que la campagne nommée exactement « Campaign #1 » et à l'état non ACTIVE.
 *
 *   node --env-file=.env.local scripts/totowood-brouillon.mjs        (lecture seule)
 *   node --env-file=.env.local scripts/totowood-brouillon.mjs --go   (supprime)
 */
import { GoogleAdsApi, ResourceNames } from "google-ads-api";

const CUSTOMER = "3702463294";
const MCC = (process.env.GOOGLE_ADS_MCC_ID || "6711813801").replace(/-/g, "");
const GO = process.argv.includes("--go");

/** La campagne qu'on protège : jamais touchée, quoi qu'il arrive. */
const CAMPAGNE_VIVANTE = "24204097327";

const api = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});
const cust = api.Customer({
  customer_id: CUSTOMER,
  login_customer_id: MCC,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});

const lignes = await cust.query(`
  SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
         campaign_budget.amount_micros
  FROM campaign
  ORDER BY campaign.id
`);

console.log(`\n${lignes.length} campagne(s) dans le compte ${CUSTOMER} :\n`);
for (const l of lignes) {
  const euros = l.campaign_budget?.amount_micros
    ? (Number(l.campaign_budget.amount_micros) / 1e6).toFixed(2) + " €/j"
    : "—";
  console.log(`  • ${l.campaign.id}  ${l.campaign.status}\t${euros}\t« ${l.campaign.name} »`);
}

const cibles = lignes.filter(
  (l) =>
    l.campaign.name === "Campaign #1" &&
    String(l.campaign.id) !== CAMPAGNE_VIVANTE &&
    l.campaign.status !== 2 /* ENABLED */,
);

if (!cibles.length) {
  console.log("\nAucun brouillon « Campaign #1 » à supprimer — rien à faire.");
  process.exit(0);
}

console.log(
  `\n${cibles.length} cible(s) : ${cibles.map((c) => c.campaign.id).join(", ")}`,
);

if (!GO) {
  console.log("Lecture seule. Relancer avec --go pour supprimer (irréversible).");
  process.exit(0);
}

const res = await cust.campaigns.remove(
  cibles.map((c) => ResourceNames.campaign(CUSTOMER, String(c.campaign.id))),
);
console.log("\nSupprimé :", JSON.stringify(res.results ?? res, null, 1));
