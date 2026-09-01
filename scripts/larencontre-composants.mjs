/**
 * Pose les composants de la campagne La Rencontre, au niveau CAMPAGNE.
 *
 * Au niveau campagne et non groupe : ils servent les trois groupes d'un coup.
 * La copie vient du même markdown que les annonces — aucune ressaisie.
 *
 *   node --env-file=.env.local scripts/larencontre-composants.mjs --dry
 *   node --env-file=.env.local scripts/larencontre-composants.mjs --go
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi, enums, ResourceNames } from "google-ads-api";

const COPIE = "D:\\projets\\restaurant-larencontre\\docs\\ads\\annonces-google-ads.md";
const CUSTOMER = "4040541764";
const CAMPAIGN = "24197703801";
const MCC = (process.env.GOOGLE_ADS_MCC_ID || "6711813801").replace(/-/g, "");
const GO = process.argv.includes("--go");

const TELEPHONE = "0547740399";
const BASE = "https://restaurantlarencontre.com";
/* Dans l'ordre du markdown : un lien annexe = un texte + deux descriptions. */
const URLS = [`${BASE}/reservation`, `${BASE}/menu`, `${BASE}/epicerie`, `${BASE}/`];

/* ── Lecture du markdown ───────────────────────────────────────────────────── */
const taille = (t) => [...t].length;
const sections = {};
{
  let clef = null;
  let limite = 0;
  for (const l of readFileSync(COPIE, "utf8").split(/\r?\n/)) {
    const h3 = l.match(/^###\s+(.+?)\s*\((\d+)\s*caractères max\)\s*$/);
    if (h3) {
      const n = h3[1];
      clef = /Liens annexes — textes/.test(n) ? "liens"
        : /Liens annexes — descriptions/.test(n) ? "liensDesc"
        : /^Accroches/.test(n) ? "accroches"
        : /^Extrait de site/.test(n) ? "extrait"
        : null;
      limite = Number(h3[2]);
      if (clef) sections[clef] = { limite, lignes: [] };
      continue;
    }
    if (/^#{2,3}\s/.test(l)) { clef = null; continue; }
    if (!clef) continue;
    const item = l.match(/^-\s+(.+?)\s*$/);
    if (item) sections[clef].lignes.push(item[1]);
  }
}

let fautes = 0;
const dire = (m) => { console.error(`✗ ${m}`); fautes++; };
for (const [nom, s] of Object.entries(sections)) {
  for (const t of s.lignes) if (taille(t) > s.limite) dire(`${nom} : ${taille(t)}/${s.limite} — « ${t} »`);
}
const liens = sections.liens?.lignes ?? [];
const liensDesc = sections.liensDesc?.lignes ?? [];
if (liens.length !== URLS.length) dire(`${liens.length} liens annexes pour ${URLS.length} URL`);
if (liensDesc.length !== liens.length * 2) dire(`${liensDesc.length} descriptions pour ${liens.length} liens (il en faut ${liens.length * 2})`);
if (!sections.accroches?.lignes.length) dire("aucune accroche");
if (!sections.extrait?.lignes.length) dire("aucune valeur d'extrait");
if (fautes) { console.error(`\n${fautes} faute(s). Rien n'a été envoyé.`); process.exit(1); }

console.log(`${liens.length} liens annexes, ${sections.accroches.lignes.length} accroches, ${sections.extrait.lignes.length} valeurs d'extrait, 1 appel`);
liens.forEach((t, i) => console.log(`  · ${t} → ${URLS[i]}  (${liensDesc[i * 2]} / ${liensDesc[i * 2 + 1]})`));

if (!GO) { console.log("\n--dry : rien n'a été envoyé."); process.exit(0); }

/* ── Envoi ─────────────────────────────────────────────────────────────────── */
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

/* Garde-fou : ne pas reposer des composants déjà là. */
const deja = await cust.query(`
  SELECT campaign.id, campaign_asset.field_type FROM campaign_asset
  WHERE campaign.id = ${CAMPAIGN}
`);
if (deja.length) {
  console.log(`${deja.length} composant(s) déjà rattaché(s) à la campagne. Rien à faire.`);
  process.exit(0);
}

const ops = [];
let tmp = -1;
const rattacher = [];

liens.forEach((texte, i) => {
  const rn = ResourceNames.asset(CUSTOMER, String(tmp--));
  ops.push({
    entity: "asset",
    operation: "create",
    resource: {
      resource_name: rn,
      final_urls: [URLS[i]],
      sitelink_asset: {
        link_text: texte,
        description1: liensDesc[i * 2],
        description2: liensDesc[i * 2 + 1],
      },
    },
  });
  rattacher.push([rn, enums.AssetFieldType.SITELINK]);
});

for (const a of sections.accroches.lignes) {
  const rn = ResourceNames.asset(CUSTOMER, String(tmp--));
  ops.push({
    entity: "asset",
    operation: "create",
    resource: { resource_name: rn, callout_asset: { callout_text: a } },
  });
  rattacher.push([rn, enums.AssetFieldType.CALLOUT]);
}

{
  const rn = ResourceNames.asset(CUSTOMER, String(tmp--));
  ops.push({
    entity: "asset",
    operation: "create",
    resource: {
      resource_name: rn,
      /* L'en-tête vient d'une liste fermée de Google : « Styles » en fait partie,
         « Types de cuisine » non — il serait refusé. */
      structured_snippet_asset: { header: "Styles", values: sections.extrait.lignes },
    },
  });
  rattacher.push([rn, enums.AssetFieldType.STRUCTURED_SNIPPET]);
}

{
  const rn = ResourceNames.asset(CUSTOMER, String(tmp--));
  ops.push({
    entity: "asset",
    operation: "create",
    resource: { resource_name: rn, call_asset: { country_code: "FR", phone_number: TELEPHONE } },
  });
  rattacher.push([rn, enums.AssetFieldType.CALL]);
}

const campagneRN = ResourceNames.campaign(CUSTOMER, CAMPAIGN);
for (const [rn, champ] of rattacher) {
  ops.push({
    entity: "campaign_asset",
    operation: "create",
    resource: { campaign: campagneRN, asset: rn, field_type: champ },
  });
}

console.log(`\n${ops.length} opérations à envoyer…`);
try {
  await cust.mutateResources(ops, { partial_failure: false });
} catch (e) {
  const msg = e?.errors?.map((x) => x.message).join(" | ") || e?.message || String(e);
  console.error(`✗ échec : ${msg}`);
  process.exit(1);
}

/* Relecture : PIÈGE consigné pour Totowood — une requête GAQL qui filtre sur
   campaign.id DOIT porter campaign.id dans le SELECT, sinon query_error 16. */
const apres = await cust.query(`
  SELECT campaign.id, campaign_asset.field_type, campaign_asset.status,
         asset.sitelink_asset.link_text, asset.callout_asset.callout_text,
         asset.structured_snippet_asset.header, asset.call_asset.phone_number
  FROM campaign_asset WHERE campaign.id = ${CAMPAIGN}
`);
console.log(`\n✓ ${apres.length} composant(s) relus :`);
const parChamp = {};
for (const l of apres) (parChamp[l.campaign_asset.field_type] ||= []).push(l);
for (const [champ, l] of Object.entries(parChamp)) console.log(`  champ ${champ} : ${l.length}`);
