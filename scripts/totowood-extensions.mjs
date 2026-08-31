/**
 * Pose les composants (ex-« extensions ») de la campagne Totowood.
 *
 * Au niveau CAMPAGNE et non groupe : ils servent les quatre groupes d'un coup.
 *
 *   · liens annexes  les quatre landing pages. Les mentions légales n'en sont
 *                    pas un : elles ne répondent à aucune intention d'achat, et
 *                    le guide les écarte explicitement.
 *   · accroches      ce qui rassure et ne tient pas dans un titre de 30.
 *   · extrait        les quatre services, en une ligne.
 *   · appel          le fixe de l'atelier. C'est le seul canal que la landing ne
 *                    sait pas attribuer, faute de numéro de redirection — le
 *                    composant Appel, lui, est compté par Google.
 *
 *   node --env-file=.env.local scripts/totowood-extensions.mjs --dry
 *   node --env-file=.env.local scripts/totowood-extensions.mjs
 */
import { GoogleAdsApi, enums, ResourceNames } from "google-ads-api";

const CUSTOMER = "3702463294";
const CAMPAIGN_ID = "24204097327";
const MCC = (process.env.GOOGLE_ADS_MCC_ID || "6711813801").replace(/-/g, "");
const DRY = process.argv.includes("--dry");

/* Liens annexes : 25 caractères de titre, 35 par ligne de description. */
const LIENS = [
  { texte: "Sous-pente & escalier", d1: "Le triangle perdu, exploité", d2: "Placards, tiroirs, cave à vin", url: "https://devis.totowood.fr/sous-pente" },
  { texte: "Dressing sur mesure", d1: "Jusqu'au plafond, sans vide", d2: "Coulissant, battant ou ouvert", url: "https://devis.totowood.fr/dressing" },
  { texte: "Bibliothèque & meubles", d1: "Du sol au plafond, sans vide", d2: "Box et câbles intégrés", url: "https://devis.totowood.fr/bibliotheque" },
  { texte: "Cuisine sur mesure", d1: "Cotes relevées chez vous", d2: "Sans fileur, sans rattrapage", url: "https://devis.totowood.fr/cuisine" },
];

/* Accroches : 25 caractères. */
const ACCROCHES = [
  "Devis gratuit sous 24 h",
  "Atelier à Annet-sur-Marne",
  "11 ans d'expérience",
  "Conçu, fabriqué et posé",
  "5,0/5 sur 18 avis Google",
  "Métré gratuit chez vous",
];

/* Extrait de site : en-tête + valeurs de 25 caractères. */
const EXTRAIT = {
  entete: enums.StructuredSnippetHeader ? "Services" : "Services",
  valeurs: ["Sous-pente", "Sous-escalier", "Dressing", "Bibliothèque", "Meuble TV", "Cuisine"],
};

const TELEPHONE = "0180813840";

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

/* Contrôle des longueurs avant tout envoi : Google tronque ou refuse. */
let fautes = 0;
const trop = (quoi, texte, max) => {
  if ([...texte].length > max) {
    console.error(`✗ ${quoi} : ${[...texte].length}/${max} — « ${texte} »`);
    fautes++;
  }
};
for (const l of LIENS) {
  trop("lien annexe", l.texte, 25);
  trop("description lien", l.d1, 35);
  trop("description lien", l.d2, 35);
}
for (const a of ACCROCHES) trop("accroche", a, 25);
for (const v of EXTRAIT.valeurs) trop("valeur d'extrait", v, 25);
if (fautes) {
  console.error(`\n${fautes} faute(s) de longueur. Rien n'a été envoyé.`);
  process.exit(1);
}
console.log(`✓ longueurs valides : ${LIENS.length} liens, ${ACCROCHES.length} accroches, ${EXTRAIT.valeurs.length} valeurs d'extrait, 1 appel`);

if (DRY) {
  console.log("--dry : rien n'a été envoyé à Google.");
  process.exit(0);
}

/* ── 1. Les composants (assets), créés au niveau du compte ─────────────────── */
const assetOps = [];
let tmp = -1;
const rnDe = [];

for (const l of LIENS) {
  const rn = ResourceNames.asset(CUSTOMER, String(tmp--));
  rnDe.push(rn);
  assetOps.push({
    entity: "asset",
    operation: "create",
    resource: {
      resource_name: rn,
      final_urls: [l.url],
      sitelink_asset: { link_text: l.texte, description1: l.d1, description2: l.d2 },
    },
  });
}
for (const a of ACCROCHES) {
  const rn = ResourceNames.asset(CUSTOMER, String(tmp--));
  rnDe.push(rn);
  assetOps.push({
    entity: "asset",
    operation: "create",
    resource: { resource_name: rn, callout_asset: { callout_text: a } },
  });
}
const rnExtrait = ResourceNames.asset(CUSTOMER, String(tmp--));
rnDe.push(rnExtrait);
assetOps.push({
  entity: "asset",
  operation: "create",
  resource: {
    resource_name: rnExtrait,
    structured_snippet_asset: { header: EXTRAIT.entete, values: EXTRAIT.valeurs },
  },
});
const rnAppel = ResourceNames.asset(CUSTOMER, String(tmp--));
rnDe.push(rnAppel);
assetOps.push({
  entity: "asset",
  operation: "create",
  resource: {
    resource_name: rnAppel,
    call_asset: { country_code: "FR", phone_number: TELEPHONE },
  },
});

/* ── 2. Le rattachement à la campagne ──────────────────────────────────────── */
const campaignRN = ResourceNames.campaign(CUSTOMER, CAMPAIGN_ID);
const champDe = (i) => {
  if (i < LIENS.length) return enums.AssetFieldType.SITELINK;
  if (i < LIENS.length + ACCROCHES.length) return enums.AssetFieldType.CALLOUT;
  if (i === LIENS.length + ACCROCHES.length) return enums.AssetFieldType.STRUCTURED_SNIPPET;
  return enums.AssetFieldType.CALL;
};
const lienOps = rnDe.map((rn, i) => ({
  entity: "campaign_asset",
  operation: "create",
  resource: { campaign: campaignRN, asset: rn, field_type: champDe(i) },
}));

const ops = [...assetOps, ...lienOps];
console.log(`\n${ops.length} opérations à envoyer…`);
try {
  await cust.mutateResources(ops, { partial_failure: false });
} catch (e) {
  const msg = e?.errors?.map((x) => x.message).join(" | ") || e?.message || String(e);
  console.error(`✗ échec : ${msg}`);
  process.exit(1);
}

/* ── 3. Relecture : on ne se fie pas au retour de l'écriture ───────────────── */
/* `campaign.id` est OBLIGATOIRE dans le SELECT dès qu'on filtre dessus : sans lui,
 * l'API renvoie query_error 16 et non un résultat vide. */
const poses = await cust.query(`
  SELECT campaign.id, campaign_asset.field_type, asset.sitelink_asset.link_text,
         asset.callout_asset.callout_text, asset.structured_snippet_asset.header,
         asset.call_asset.phone_number
  FROM campaign_asset
  WHERE campaign.id = ${CAMPAIGN_ID}
`);
const parType = {};
for (const r of poses) {
  const t = r.campaign_asset.field_type;
  parType[t] = (parType[t] || 0) + 1;
}
console.log("\n=== Composants posés sur la campagne ===");
for (const [t, n] of Object.entries(parType)) console.log(`  ${String(n).padStart(2)}  ${t}`);
