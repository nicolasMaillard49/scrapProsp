/**
 * La Rencontre — corrige le nombre d'avis Google dans les annonces : « 150 » -> « plus de 220 ».
 *
 * Relevé le 11/09/2026 par Nicolas : la fiche affiche plus de 220 avis, pas 150.
 * Le chiffre est dans sept textes en ligne : un titre et une description par
 * groupe (Italien, Gastronomique, Découverte) et une accroche de campagne.
 *
 * Les annonces sont mises à jour EN PLACE (même id d'annonce, l'historique est
 * conservé) : on renvoie la liste complète des titres et descriptions, pins
 * compris, avec les textes touchés remplacés. Une accroche ne se modifie pas :
 * on en crée une nouvelle, on la lie à la campagne, on délie l'ancienne.
 *
 * Effet de bord attendu : les trois annonces repassent en examen de règles
 * quelques heures (elles étaient APPROVED). Rien d'autre n'est touché.
 *
 *   cd C:/Users/n.maillard/VueJS/scrapProsp
 *   node --import tsx scripts/larencontre-avis-220.mjs        # controle, valide sans ecrire
 *   node --import tsx scripts/larencontre-avis-220.mjs --go   # applique
 */
import { readFileSync } from "fs";

const loadEnv = (path, filter = () => true) => {
  let raw;
  try { raw = readFileSync(path, "utf8"); } catch { return 0; }
  let n = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(k) || !filter(k)) continue;
    if (process.env[k] === undefined) { process.env[k] = v; n++; }
  }
  return n;
};
loadEnv(new URL("../.env.local", import.meta.url));
loadEnv("C:/Users/n.maillard/Obsidian/Cerveau/Credentials.md", (k) => k.startsWith("GOOGLE_ADS_"));

const { enums } = await import("google-ads-api");
const { clientCustomer } = await import("../app/lib/googleAds/client.ts");

const CUSTOMER = "4040541764";
const CAMPAIGN = "24197703801";
const GO = process.argv.includes("--go");

const ANCIEN_TITRE = "5,0/5 sur 150 avis Google";
const NOUVEAU_TITRE = "5,0/5, Plus de 220 Avis Google";   // 30 caracteres, la limite
const ANCIENNE_ACCROCHE = "5,0/5 sur 150 avis";
const NOUVELLE_ACCROCHE = "5,0/5, plus de 220 avis";      // 23 caracteres, limite 25
const descr = (t) => t.replace("sur 150 avis", "sur plus de 220 avis");

let fautes = 0;
const dire = (m) => { console.error(`x ${m}`); fautes++; };
if (NOUVEAU_TITRE.length > 30) dire(`titre trop long (${NOUVEAU_TITRE.length})`);
if (NOUVELLE_ACCROCHE.length > 25) dire(`accroche trop longue (${NOUVELLE_ACCROCHE.length})`);

const cust = clientCustomer(CUSTOMER);

/* ── Les annonces ──────────────────────────────────────────────────────────── */
const ads = await cust.query(`
  SELECT campaign.id, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.resource_name,
         ad_group_ad.ad.responsive_search_ad.headlines,
         ad_group_ad.ad.responsive_search_ad.descriptions
  FROM ad_group_ad
  WHERE campaign.id = ${CAMPAIGN} AND ad_group_ad.status != 'REMOVED'`);

const ops = [];
for (const r of ads) {
  const rsa = r.ad_group_ad.ad.responsive_search_ad;
  let touches = 0;
  const headlines = rsa.headlines.map((h) => {
    if (h.text !== ANCIEN_TITRE) return { text: h.text, pinned_field: h.pinned_field };
    touches++;
    return { text: NOUVEAU_TITRE, pinned_field: h.pinned_field };
  });
  const descriptions = rsa.descriptions.map((d) => {
    const t = descr(d.text);
    if (t !== d.text) touches++;
    if (t.length > 90) dire(`description trop longue (${t.length}) : ${t}`);
    return { text: t, pinned_field: d.pinned_field };
  });
  console.log(`\n## ${r.ad_group.name} (annonce ${r.ad_group_ad.ad.id}) : ${touches} texte(s) a changer`);
  headlines.filter((h) => h.text === NOUVEAU_TITRE).forEach((h) => console.log(`  titre       -> ${h.text}`));
  descriptions.filter((d) => d.text.includes("220")).forEach((d) => console.log(`  description -> ${d.text} (${d.text.length})`));
  if (!touches) continue;
  ops.push({
    entity: "ad",
    operation: "update",
    resource: {
      resource_name: r.ad_group_ad.ad.resource_name,
      responsive_search_ad: { headlines, descriptions },
    },
    update_mask: { paths: ["responsive_search_ad.headlines", "responsive_search_ad.descriptions"] },
  });
}

/* ── L'accroche de campagne ────────────────────────────────────────────────── */
const accroches = await cust.query(`
  SELECT campaign.id, asset.id, asset.callout_asset.callout_text, campaign_asset.resource_name
  FROM campaign_asset
  WHERE campaign.id = ${CAMPAIGN} AND campaign_asset.field_type = 'CALLOUT'
    AND campaign_asset.status != 'REMOVED'`);
const ancienne = accroches.find((a) => a.asset.callout_asset?.callout_text === ANCIENNE_ACCROCHE);
const dejaNouvelle = accroches.find((a) => a.asset.callout_asset?.callout_text === NOUVELLE_ACCROCHE);
console.log(`\n## Accroches de campagne : ${accroches.length}, ancienne ${ancienne ? "presente" : "absente"}, nouvelle ${dejaNouvelle ? "deja la" : "a creer"}`);

if (fautes) { console.error(`\n${fautes} faute(s). Rien n'a ete envoye.`); process.exit(1); }
if (!ops.length && !ancienne && dejaNouvelle) { console.log("\nRien a faire : tout est deja a 220."); process.exit(0); }

/* ── Validation puis envoi ─────────────────────────────────────────────────── */
const envoyer = async (liste, opts) => {
  try { return await cust.mutateResources(liste, opts); }
  catch (e) {
    const m = e?.errors?.map((x) => `${x.message} (${JSON.stringify(x.error_code)})`).join(" | ") || e?.message || String(e);
    console.error(`  x refus : ${m}`); process.exit(1);
  }
};

console.log(`\nValidation des ${ops.length} mise(s) a jour d'annonce (validate_only)...`);
if (ops.length) { await envoyer(ops, { validate_only: true }); console.log("  ok"); }

if (!GO) { console.log("\nControle seul : RIEN n'a ete ecrit chez Google. Relancer avec --go pour appliquer."); process.exit(0); }

if (ops.length) {
  console.log("\nEnvoi des annonces...");
  const res = await envoyer(ops, {});
  console.log(`  ${(res?.mutate_operation_responses || []).filter((r) => r?.ad_result).length} annonce(s) mise(s) a jour`);
}

/* Reprenable : chaque etape est sautee si elle est deja faite. */
if (!dejaNouvelle) {
  console.log("\nAccroche : creation et liaison de la nouvelle...");
  const cree = await envoyer([{
    entity: "asset", operation: "create",
    resource: { callout_asset: { callout_text: NOUVELLE_ACCROCHE } },
  }], {});
  const assetRn = cree.mutate_operation_responses[0].asset_result.resource_name;
  console.log(`  cree ${assetRn}`);
  await envoyer([{
    entity: "campaign_asset", operation: "create",
    resource: { campaign: `customers/${CUSTOMER}/campaigns/${CAMPAIGN}`, asset: assetRn, field_type: enums.AssetFieldType.CALLOUT },
  }], {});
  console.log("  liee a la campagne");
}
if (ancienne) {
  /* Pour un retrait, la lib attend le resource_name dans `resource`, pas dans `resource_name`. */
  await envoyer([{ entity: "campaign_asset", operation: "remove", resource: ancienne.campaign_asset.resource_name }], {});
  console.log(`  ancienne accroche ${ancienne.asset.id} deliee (elle reste dans la bibliotheque)`);
}

/* ── Relecture ─────────────────────────────────────────────────────────────── */
const relu = await cust.query(`
  SELECT campaign.id, ad_group.name, ad_group_ad.policy_summary.approval_status,
         ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions
  FROM ad_group_ad WHERE campaign.id = ${CAMPAIGN} AND ad_group_ad.status != 'REMOVED'`);
console.log("\nRelu chez Google :");
for (const r of relu) {
  const rsa = r.ad_group_ad.ad.responsive_search_ad;
  const reste150 = [...rsa.headlines, ...rsa.descriptions].filter((x) => x.text.includes("150 avis")).length;
  const a220 = [...rsa.headlines, ...rsa.descriptions].filter((x) => x.text.includes("220")).length;
  console.log(`  ${r.ad_group.name.padEnd(14)} ${a220} texte(s) a 220, ${reste150} a 150, approbation ${enums.PolicyApprovalStatus[r.ad_group_ad.policy_summary.approval_status]}`);
}
const acc = await cust.query(`
  SELECT campaign.id, asset.callout_asset.callout_text FROM campaign_asset
  WHERE campaign.id = ${CAMPAIGN} AND campaign_asset.field_type = 'CALLOUT' AND campaign_asset.status != 'REMOVED'`);
console.log(`  accroches : ${acc.map((a) => a.asset.callout_asset.callout_text).join(" · ")}`);
