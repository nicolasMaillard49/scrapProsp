/**
 * Crée les groupes d'annonces Totowood restants, depuis la source de vérité.
 *
 * Lit `D:\projets\totowood-lp\docs\annonces-google-ads.md` — le même fichier que
 * `check-annonces.mjs` valide — et pose, par groupe : le groupe d'annonces, ses
 * mots clés en EXACT **et** en EXPRESSION, et l'annonce responsive (15 titres,
 * 4 descriptions, chemin d'affichage). Renomme au passage le groupe créé par
 * l'assistant, resté « Groupe d'annonces 1 ».
 *
 * Pourquoi par API et pas au navigateur : l'assistant de création ne prend qu'un
 * groupe, et le reste se saisit champ par champ — 60 titres et 16 descriptions à
 * la main, avec le piège de concaténation constaté le 31/08. Ici la copie vient
 * du fichier déjà validé, sans intermédiaire.
 *
 *   node --env-file=.env.local scripts/totowood-adgroups.mjs --dry
 *   node --env-file=.env.local scripts/totowood-adgroups.mjs
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi, enums, ResourceNames } from "google-ads-api";

const SOURCE = "D:\\projets\\totowood-lp\\docs\\annonces-google-ads.md";
const CUSTOMER = "3702463294";
const CAMPAIGN_ID = "24204097327";
const MCC = (process.env.GOOGLE_ADS_MCC_ID || "6711813801").replace(/-/g, "");
const DRY = process.argv.includes("--dry");

/* Le groupe 1 existe déjà, créé par l'assistant : on ne le recrée pas, on le renomme. */
const DEJA_CREE = "Sous-pente & sous-escalier";

/* ── Lecture du markdown ───────────────────────────────────────────────────── */
const lignes = readFileSync(SOURCE, "utf8").split(/\r?\n/);
const groupes = [];
let g = null;
let champ = null;

for (const l of lignes) {
  const titre = l.match(/^## (?:\d+\.\s*)(.+)$/);
  if (titre) {
    g = { nom: titre[1].trim(), motsCles: [], titres: [], descriptions: [], url: null, path1: null, path2: null };
    groupes.push(g);
    champ = null;
    continue;
  }
  /* Un `##` sans numéro clôt la série des groupes (section « génériques »). */
  if (/^## /.test(l)) { g = null; champ = null; continue; }
  if (!g) continue;

  const sous = l.match(/^### (.+)$/);
  if (sous) {
    const n = sous[1].trim();
    champ = n.startsWith("Mots clés") ? "kw" : n === "Titres" ? "t" : n === "Descriptions" ? "d" : null;
    continue;
  }

  const url = l.match(/\*\*URL finale\*\*\s*:\s*`([^`]+)`/);
  if (url) { g.url = url[1]; continue; }
  const chemin = l.match(/\*\*Chemin d'affichage\*\*\s*:\s*`[^\/]+\/([^\/`]+)\/([^\/`]+)`/);
  if (chemin) { g.path1 = chemin[1]; g.path2 = chemin[2]; continue; }

  if (champ === "kw") {
    /* Lignes de tableau `| 390 | meubles pour sous pente |`, en sautant l'en-tête. */
    const m = l.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|$/);
    if (m) g.motsCles.push(m[2]);
    continue;
  }
  if (champ === "t" || champ === "d") {
    const m = l.match(/^\s*\d+\.\s+(.*\S)\s*$/);
    if (m) (champ === "t" ? g.titres : g.descriptions).push(m[1]);
  }
}

/* ── Contrôles avant d'écrire quoi que ce soit ─────────────────────────────── */
let fautes = 0;
for (const x of groupes) {
  const dire = (m) => { console.error(`✗ ${x.nom} : ${m}`); fautes++; };
  if (x.titres.length !== 15) dire(`${x.titres.length} titres au lieu de 15`);
  if (x.descriptions.length !== 4) dire(`${x.descriptions.length} descriptions au lieu de 4`);
  if (!x.motsCles.length) dire("aucun mot clé");
  if (!x.url) dire("URL finale absente");
  if (!x.path1 || !x.path2) dire("chemin d'affichage absent");
  for (const t of x.titres) if ([...t].length > 30) dire(`titre ${[...t].length}/30 — « ${t} »`);
  for (const d of x.descriptions) if ([...d].length > 90) dire(`description ${[...d].length}/90`);
}
if (fautes) {
  console.error(`\n${fautes} faute(s) dans ${SOURCE}. Rien n'a été envoyé.`);
  process.exit(1);
}

console.log(`${groupes.length} groupes lus dans le markdown :`);
for (const x of groupes) {
  console.log(`  · ${x.nom} — ${x.motsCles.length} mots clés, ${x.titres.length} titres, ${x.descriptions.length} descriptions`);
}

const aCreer = groupes.filter((x) => x.nom !== DEJA_CREE);
console.log(`\nÀ créer : ${aCreer.map((x) => x.nom).join(", ")}`);
console.log(`À renommer : le groupe existant → « ${DEJA_CREE} »\n`);

if (DRY) {
  console.log("--dry : rien n'a été envoyé à Google.");
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

/* Renommage du groupe de l'assistant. On le retrouve par sa campagne, pas par son
 * nom : « Groupe d'annonces 1 » est un libellé localisé, donc fragile. */
const existants = await cust.query(`
  SELECT ad_group.id, ad_group.name, ad_group.resource_name
  FROM ad_group
  WHERE campaign.id = ${CAMPAIGN_ID}
`);
console.log(`Groupes déjà dans la campagne : ${existants.map((r) => `« ${r.ad_group.name} »`).join(", ") || "aucun"}`);

const ops = [];
for (const r of existants) {
  if (r.ad_group.name !== DEJA_CREE) {
    ops.push({
      entity: "ad_group",
      operation: "update",
      resource: { resource_name: r.ad_group.resource_name, name: DEJA_CREE },
      update_mask: { paths: ["name"] },
    });
    console.log(`  → renommage « ${r.ad_group.name} » en « ${DEJA_CREE} »`);
  }
}

const campaignRN = ResourceNames.campaign(CUSTOMER, CAMPAIGN_ID);
let tmp = -1;

for (const x of aCreer) {
  const agRN = ResourceNames.adGroup(CUSTOMER, String(tmp--));
  ops.push({
    entity: "ad_group",
    operation: "create",
    resource: {
      resource_name: agRN,
      name: x.nom,
      campaign: campaignRN,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.SEARCH_STANDARD,
    },
  });

  /* Chaque terme en EXACT et en EXPRESSION, jamais en requête large. */
  for (const texte of x.motsCles) {
    for (const match of ["EXACT", "PHRASE"]) {
      ops.push({
        entity: "ad_group_criterion",
        operation: "create",
        resource: {
          ad_group: agRN,
          status: enums.AdGroupCriterionStatus.ENABLED,
          keyword: { text: texte, match_type: enums.KeywordMatchType[match] },
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
        final_urls: [x.url],
        responsive_search_ad: {
          headlines: x.titres.map((t) => ({ text: t })),
          descriptions: x.descriptions.map((t) => ({ text: t })),
          path1: x.path1,
          path2: x.path2,
        },
      },
    },
  });
}

console.log(`\n${ops.length} opérations à envoyer…`);
try {
  const res = await cust.mutateResources(ops, { partial_failure: false });
  const n = res?.results?.length ?? 0;
  console.log(`✓ ${n} ressources créées ou modifiées.`);
} catch (e) {
  const msg = e?.errors?.map((x) => x.message).join(" | ") || e?.message || String(e);
  console.error(`✗ échec : ${msg}`);
  process.exit(1);
}

/* Relecture : on ne se fie pas au retour de l'écriture. */
const apres = await cust.query(`
  SELECT ad_group.id, ad_group.name, ad_group.status
  FROM ad_group
  WHERE campaign.id = ${CAMPAIGN_ID}
  ORDER BY ad_group.name
`);
console.log("\n=== Groupes d'annonces après écriture ===");
for (const r of apres) console.log(`  ${r.ad_group.id}  ${r.ad_group.status}  ${r.ad_group.name}`);

const kws = await cust.query(`
  SELECT ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
  FROM keyword_view
  WHERE campaign.id = ${CAMPAIGN_ID}
`);
const parGroupe = {};
for (const r of kws) {
  const n = r.ad_group.name;
  parGroupe[n] = (parGroupe[n] || 0) + 1;
}
console.log("\n=== Mots clés par groupe ===");
for (const [n, c] of Object.entries(parGroupe)) console.log(`  ${String(c).padStart(3)}  ${n}`);
