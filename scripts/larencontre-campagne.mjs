/**
 * Monte la campagne de test La Rencontre, EN PAUSE, dans le compte 404-054-1764.
 *
 * Tout vient de sources déjà validées, rien n'est ressaisi :
 *  · la copie  → restaurant-larencontre/docs/ads/annonces-google-ads.md
 *                (le fichier que check-annonces.mjs valide)
 *  · les mots clés, leurs volumes, les exclusions et les zones géographiques
 *                → audit/la-rencontre/data/*.json
 *
 * Ce qu'il pose : budget, campagne PAUSE, réseau Recherche seul, zones,
 * langue, calendrier de diffusion, 27 exclusions de campagne, 3 groupes,
 * leurs mots clés en expression ET exact, et une annonce responsive par groupe.
 *
 * La campagne est créée **PAUSED**. Rien ne diffuse tant qu'un humain n'a pas
 * dé-pausé — et il ne faut pas le faire avant que la conversion `generate_lead`
 * soit étoilée dans GA4 puis importée ici, sinon on dépense à l'aveugle.
 *
 *   node --env-file=.env.local scripts/larencontre-campagne.mjs --dry
 *   node --env-file=.env.local scripts/larencontre-campagne.mjs --go
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi, enums, ResourceNames } from "google-ads-api";

const COPIE = "D:\\projets\\restaurant-larencontre\\docs\\ads\\annonces-google-ads.md";
const AUDIT = "D:\\projets\\audit\\la-rencontre\\data";
const CUSTOMER = "4040541764";
const MCC = (process.env.GOOGLE_ADS_MCC_ID || "6711813801").replace(/-/g, "");
const GO = process.argv.includes("--go");

const NOM_CAMPAGNE = "Recherche - La Rencontre Soir";
const URL_FINALE = "https://restaurantlarencontre.com/reservation";
/* 150 €/mois ÷ 30,4 = 4,93 €/jour. Multiple de 10 000 µ, sinon Google refuse. */
const BUDGET_MICROS = 4_930_000;

/** Groupe d'annonces → famille du portefeuille de l'audit. */
const FAMILLE = {
  "Groupe 1 — Italien": "B",
  "Groupe 2 — Gastronomique": "A",
  "Groupe 3 — Découverte": "F",
};

/**
 * Calendrier de diffusion — tous les jours, 17h00 à 22h00.
 *
 * « Soir uniquement » porte sur le SERVICE vendu, pas sur les jours d'ouverture :
 * une table du samedi se réserve souvent le lundi. Diffuser seulement mercredi à
 * samedi rendrait aveugle sur ceux qui anticipent. En revanche la tranche exclut
 * le midi, qui est le vrai gaspillage — le restaurant sert aussi à midi, mais
 * c'est hors périmètre du test.
 * À rouvrir avec le rapport « Heure de la journée » après deux semaines.
 */
const PLAGES = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const HEURE_DEBUT = 17;
const HEURE_FIN = 22;

/* ── Lecture de la copie ───────────────────────────────────────────────────── */
const taille = (t) => [...t].length;
const groupes = [];
{
  let g = null;
  let champ = null;
  let limite = 0;
  for (const l of readFileSync(COPIE, "utf8").split(/\r?\n/)) {
    const h2 = l.match(/^##\s+(?!#)(.+)$/);
    if (h2) {
      const nom = h2[1].trim();
      g = FAMILLE[nom] ? { nom, titres: [], descriptions: [] } : null;
      if (g) groupes.push(g);
      champ = null;
      continue;
    }
    const h3 = l.match(/^###\s+(.+?)\s*\((\d+)\s*caractères max\)\s*$/);
    if (h3) {
      champ = /^Titres/.test(h3[1]) ? "t" : /^Descriptions/.test(h3[1]) ? "d" : null;
      limite = Number(h3[2]);
      continue;
    }
    if (/^###/.test(l)) { champ = null; continue; }
    if (!g || !champ) continue;
    const item = l.match(/^-\s+(.+?)\s*$/);
    if (item) {
      const texte = item[1];
      if (taille(texte) > limite) {
        console.error(`✗ ${g.nom} : ${taille(texte)}/${limite} — « ${texte} »`);
        process.exit(1);
      }
      (champ === "t" ? g.titres : g.descriptions).push(texte);
    }
  }
}

/* ── Lecture de l'audit ────────────────────────────────────────────────────── */
const portefeuille = JSON.parse(readFileSync(`${AUDIT}\\portefeuille-mots-cles.json`, "utf8"));
const brutes = JSON.parse(readFileSync(`${AUDIT}\\donnees-google-ads-brutes.json`, "utf8"));
const volume = Object.fromEntries(brutes.historical.filter((k) => k.vol).map((k) => [k.text, k.vol]));

for (const g of groupes) {
  const f = FAMILLE[g.nom];
  g.motsCles = portefeuille.keywords
    .filter((k) => k.famille === f && volume[k.text])
    .sort((a, b) => volume[b.text] - volume[a.text])
    .map((k) => k.text);
}

const exclusions = portefeuille.exclusions.map((e) =>
  typeof e === "string" ? e : e.text || e.terme || e.mot || String(e),
);
const zones = brutes.geo.map((z) => z.geo);

/* ── Contrôles avant toute écriture ────────────────────────────────────────── */
let fautes = 0;
const dire = (m) => { console.error(`✗ ${m}`); fautes++; };
if (groupes.length !== 3) dire(`${groupes.length} groupes lus au lieu de 3`);
for (const g of groupes) {
  if (g.titres.length !== 15) dire(`${g.nom} : ${g.titres.length} titres au lieu de 15`);
  if (g.descriptions.length !== 4) dire(`${g.nom} : ${g.descriptions.length} descriptions au lieu de 4`);
  if (!g.motsCles.length) dire(`${g.nom} : aucun mot clé`);
}
if (!zones.length) dire("aucune zone géographique");
if (!exclusions.length) dire("aucune exclusion");
if (BUDGET_MICROS % 10_000) dire("budget non multiple de 10 000 µ — Google refusera");
if (fautes) { console.error(`\n${fautes} faute(s). Rien n'a été envoyé.`); process.exit(1); }

console.log(`Compte ${CUSTOMER} · campagne « ${NOM_CAMPAGNE} » · ${(BUDGET_MICROS / 1e6).toFixed(2)} €/jour`);
console.log(`Zones : ${zones.length} · Exclusions : ${exclusions.length} · Diffusion ${HEURE_DEBUT}h-${HEURE_FIN}h, ${PLAGES.length} jours`);
for (const g of groupes) {
  console.log(`  · ${g.nom} — ${g.motsCles.length} mots clés (×2 types), ${g.titres.length} titres, ${g.descriptions.length} descriptions`);
  console.log(`      ${g.motsCles.slice(0, 4).join(" · ")}${g.motsCles.length > 4 ? " …" : ""}`);
}

if (!GO) {
  console.log("\n--dry : rien n'a été envoyé à Google. Relancer avec --go.");
  process.exit(0);
}

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

/* Garde-fou : ne jamais créer deux fois la même campagne. */
const deja = await cust.query(`
  SELECT campaign.id, campaign.name, campaign.status FROM campaign
`);
if (deja.some((l) => l.campaign.name === NOM_CAMPAGNE)) {
  console.log(`« ${NOM_CAMPAGNE} » existe déjà. Rien à faire.`);
  process.exit(0);
}
console.log(`\n${deja.length} campagne(s) déjà dans le compte : ${deja.map((l) => `« ${l.campaign.name} »`).join(", ") || "aucune"}`);

const ops = [];
let tmp = -1;

const budgetRN = ResourceNames.campaignBudget(CUSTOMER, String(tmp--));
ops.push({
  entity: "campaign_budget",
  operation: "create",
  resource: {
    resource_name: budgetRN,
    name: `Budget — ${NOM_CAMPAGNE}`,
    amount_micros: BUDGET_MICROS,
    delivery_method: enums.BudgetDeliveryMethod.STANDARD,
    explicitly_shared: false,
  },
});

const campagneRN = ResourceNames.campaign(CUSTOMER, String(tmp--));
ops.push({
  entity: "campaign",
  operation: "create",
  resource: {
    resource_name: campagneRN,
    name: NOM_CAMPAGNE,
    /* PAUSE : rien ne diffuse avant un geste humain. */
    status: enums.CampaignStatus.PAUSED,
    advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
    campaign_budget: budgetRN,
    /* Maximiser les clics = le champ target_spend, pas « maximize_clicks ». */
    target_spend: {},
    network_settings: {
      target_google_search: true,
      target_search_network: false,
      target_content_network: false,
      target_partner_search_network: false,
    },
    geo_target_type_setting: {
      positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
      negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
    },
    /* Obligatoire à la création depuis 2025, sinon « required field was not present ». */
    contains_eu_political_advertising:
      enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING,
  },
});

/* Zones, langue, calendrier et exclusions : tous des critères de campagne. */
for (const geo of zones) {
  ops.push({
    entity: "campaign_criterion",
    operation: "create",
    resource: { campaign: campagneRN, location: { geo_target_constant: geo } },
  });
}
ops.push({
  entity: "campaign_criterion",
  operation: "create",
  resource: { campaign: campagneRN, language: { language_constant: "languageConstants/1002" } },
});
for (const jour of PLAGES) {
  ops.push({
    entity: "campaign_criterion",
    operation: "create",
    resource: {
      campaign: campagneRN,
      ad_schedule: {
        day_of_week: enums.DayOfWeek[jour],
        start_hour: HEURE_DEBUT,
        start_minute: enums.MinuteOfHour.ZERO,
        end_hour: HEURE_FIN,
        end_minute: enums.MinuteOfHour.ZERO,
      },
    },
  });
}
for (const terme of exclusions) {
  ops.push({
    entity: "campaign_criterion",
    operation: "create",
    resource: {
      campaign: campagneRN,
      negative: true,
      keyword: { text: terme, match_type: enums.KeywordMatchType.BROAD },
    },
  });
}

for (const g of groupes) {
  const agRN = ResourceNames.adGroup(CUSTOMER, String(tmp--));
  ops.push({
    entity: "ad_group",
    operation: "create",
    resource: {
      resource_name: agRN,
      name: g.nom.replace(/^Groupe \d+ — /, ""),
      campaign: campagneRN,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.SEARCH_STANDARD,
    },
  });
  /* Expression ET exact, jamais de requête large. */
  for (const texte of g.motsCles) {
    for (const type of ["PHRASE", "EXACT"]) {
      ops.push({
        entity: "ad_group_criterion",
        operation: "create",
        resource: {
          ad_group: agRN,
          status: enums.AdGroupCriterionStatus.ENABLED,
          keyword: { text: texte, match_type: enums.KeywordMatchType[type] },
        },
      });
    }
  }
  ops.push({
    entity: "ad_group_ad",
    operation: "create",
    resource: {
      ad_group: agRN,
      status: enums.AdGroupAdStatus.ENABLED,
      ad: {
        final_urls: [URL_FINALE],
        responsive_search_ad: {
          headlines: g.titres.map((t) => ({ text: t })),
          descriptions: g.descriptions.map((t) => ({ text: t })),
          path1: "reserver",
          path2: "bordeaux",
        },
      },
    },
  });
}

console.log(`\n${ops.length} opérations à envoyer…`);
try {
  const res = await cust.mutateResources(ops, { partial_failure: false });
  console.log(`✓ ${res?.results?.length ?? 0} ressources créées.`);
} catch (e) {
  const msg = e?.errors?.map((x) => x.message).join(" | ") || e?.message || String(e);
  console.error(`✗ échec : ${msg}`);
  process.exit(1);
}

/* Relecture : on ne se fie jamais au retour de l'écriture. */
const apres = await cust.query(`
  SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros
  FROM campaign
  WHERE campaign.name = '${NOM_CAMPAGNE}'
`);
for (const l of apres) {
  console.log(
    `\nRelu : ${l.campaign.id} « ${l.campaign.name} » — statut ${l.campaign.status}, ` +
      `${(Number(l.campaign_budget.amount_micros) / 1e6).toFixed(2)} €/jour`,
  );
}
const gr = await cust.query(`
  SELECT campaign.id, ad_group.id, ad_group.name FROM ad_group
  WHERE campaign.name = '${NOM_CAMPAGNE}'
`);
console.log(`Groupes : ${gr.map((l) => `${l.ad_group.name} (${l.ad_group.id})`).join(", ")}`);
