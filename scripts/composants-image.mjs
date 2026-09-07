/**
 * Pose des composants Image sur une campagne Recherche, depuis un manifeste.
 *
 * Constat du 07/09/2026 : ni La Rencontre ni Totowood n'avaient d'image sur
 * leurs annonces — aucun script n'en avait jamais posé. Google annonce +6 % de
 * CTR en moyenne quand une image s'affiche avec une annonce Recherche (doc
 * « À propos des composants Image », donnée interne avril 2023). Sur un compte
 * à budget saturé, un CTR observé plus haut remonte la composante « CTR
 * attendu » du Quality Score, donc baisse le CPC : c'est le vrai gain.
 *
 * Le manifeste (JSON, dans `audit-nmf/<client>/data/composants-image.json`)
 * dit quoi recadrer et où le poser :
 *   · `niveau: "campagne"` → campaign_asset, les images servent tous les groupes ;
 *   · `niveau: "groupe"`   → ad_group_asset, chaque image porte un `groupe`
 *     cherché dans le nom du groupe d'annonces (sans casse).
 * Sur Recherche, carré et paysage se lient tous deux avec le champ AD_IMAGE —
 * MARKETING_IMAGE / SQUARE_MARKETING_IMAGE sont réservés au Display et à PMax
 * (Google refuse : « field type incompatible with campaign type SEARCH »).
 * Formats Google : carré 1:1 (min 300×300, sortie 1200×1200 max), paysage
 * 1,91:1 (min 600×314, sortie 1200×628). JPEG ≤ 5 120 Ko. Pas de texte ni de
 * logo incrusté, pas de flou : refus à la validation.
 *
 * Le lien AD_IMAGE exige un compte éligible aux images : La Rencontre est passé
 * le 07/09/2026, Totowood a été refusé le même jour (« field type not supported
 * to be added directly through asset links »), au niveau groupe comme campagne.
 * Le niveau groupe d'annonces n'a été essayé que sur Totowood (refusé, mais le
 * compte l'était aussi au niveau campagne) : non prouvé sur un compte éligible.
 *
 * Sans drapeau : recadre dans `outputDir`, affiche l'état et le plan.
 * `--go` : envoie, tout ou rien, puis relit. On ne se fie jamais au retour de
 * l'écriture. Idempotent : un asset dont le nom existe déjà n'est pas recréé,
 * un lien déjà en place n'est pas reposé.
 *
 *   node --import tsx scripts/composants-image.mjs --manifest C:/Users/n.maillard/audit-nmf/la-rencontre/data/composants-image.json
 *   node --import tsx scripts/composants-image.mjs --manifest ... --go
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";

/** .env.local du checkout + bloc GOOGLE_ADS_* du vault (absents du .env.local ici). */
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
const fromVault = loadEnv("C:/Users/n.maillard/Obsidian/Cerveau/Credentials.md", (k) => k.startsWith("GOOGLE_ADS_"));
console.log(`Credentials : ${fromVault} variables GOOGLE_ADS_* reprises du vault`);

const sharp = (await import("sharp")).default;
const { enums, ResourceNames } = await import("google-ads-api");
const { clientCustomer } = await import("../app/lib/googleAds/client.ts");

const argManifest = process.argv.indexOf("--manifest");
if (argManifest < 0 || !process.argv[argManifest + 1]) {
  console.error("Usage : node --import tsx scripts/composants-image.mjs --manifest <chemin.json> [--go]");
  process.exit(1);
}
const MANIFEST = resolve(process.argv[argManifest + 1]);
const GO = process.argv.includes("--go");
const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
const baseDir = dirname(MANIFEST);
const sourceDir = resolve(baseDir, m.sourceDir);
const outputDir = resolve(baseDir, m.outputDir);
mkdirSync(outputDir, { recursive: true });

const CUSTOMER = String(m.customer).replace(/-/g, "");
const CAMPAIGN_ID = Number(m.campaignId);
const NIVEAU = m.niveau === "groupe" ? "groupe" : "campagne";
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const OUT = resolve(baseDir, `composants-image-${AUJOURDHUI}.json`);

const FORMATS = {
  carre: { ratio: 1, largeurMax: 1200, minL: 300, minH: 300, champ: enums.AssetFieldType.AD_IMAGE, champNom: "AD_IMAGE" },
  paysage: { ratio: 1.91, largeurMax: 1200, minL: 600, minH: 314, champ: enums.AssetFieldType.AD_IMAGE, champNom: "AD_IMAGE" },
};

/* ── 1. Recadrage ──────────────────────────────────────────────────────────── */
const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
console.log(`\n── Recadrage (${m.images.length} images, ${m.client}) ──`);
const prepares = [];
let fautes = 0;
for (const img of m.images) {
  const f = FORMATS[img.format];
  if (!f) { console.error(`  ✗ ${img.nom} : format inconnu « ${img.format} »`); fautes++; continue; }
  const src = resolve(sourceDir, img.fichier);
  const [gauche, haut, largeur, hauteur] = img.zone;
  const ratioZone = largeur / hauteur;
  if (Math.abs(ratioZone - f.ratio) > 0.02) {
    console.error(`  ✗ ${img.nom} : la zone fait ${ratioZone.toFixed(3)}, attendu ${f.ratio}`);
    fautes++;
    continue;
  }
  const meta = await sharp(src).metadata();
  if (meta.orientation && meta.orientation !== 1) {
    // Les zones sont mesurées sur les pixels stockés ; une rotation EXIF les rendrait fausses.
    console.error(`  ✗ ${img.nom} : orientation EXIF ${meta.orientation}, redresser le fichier avant de mesurer la zone`);
    fautes++;
    continue;
  }
  if (gauche + largeur > meta.width || haut + hauteur > meta.height) {
    console.error(`  ✗ ${img.nom} : zone hors de l'image (${meta.width}×${meta.height})`);
    fautes++;
    continue;
  }
  const largeurSortie = Math.min(largeur, f.largeurMax);
  const hauteurSortie = Math.round(largeurSortie / f.ratio);
  const fichierSortie = resolve(outputDir, `${slug(img.nom)}.jpg`);
  const buffer = await sharp(src)
    .extract({ left: gauche, top: haut, width: largeur, height: hauteur })
    .resize(largeurSortie, hauteurSortie, { fit: "fill" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  writeFileSync(fichierSortie, buffer);
  const ko = Math.round(buffer.length / 1024);
  if (largeurSortie < f.minL || hauteurSortie < f.minH || ko > 5120) {
    console.error(`  ✗ ${img.nom} : ${largeurSortie}×${hauteurSortie}, ${ko} Ko — hors des bornes Google`);
    fautes++;
    continue;
  }
  prepares.push({ ...img, champ: f.champ, champNom: f.champNom, fichierSortie, largeurSortie, hauteurSortie, ko, buffer });
  console.log(`  ✓ ${img.nom} → ${basename(fichierSortie)} ${largeurSortie}×${hauteurSortie}, ${ko} Ko`);
}
if (fautes) { console.error(`\n${fautes} image(s) en faute. Rien n'a été envoyé.`); process.exit(1); }

/* ── 2. État dans le compte ────────────────────────────────────────────────── */
const cust = clientCustomer(CUSTOMER);

async function lireEtat() {
  const campagne = await cust.query(`
    SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.id = ${CAMPAIGN_ID}
  `);
  const groupes = await cust.query(`
    SELECT ad_group.id, ad_group.name, ad_group.resource_name, ad_group.status
    FROM ad_group WHERE campaign.id = ${CAMPAIGN_ID} AND ad_group.status != 'REMOVED'
  `);
  const assets = await cust.query(`
    SELECT asset.id, asset.name, asset.resource_name, asset.image_asset.full_size.width_pixels,
           asset.image_asset.full_size.height_pixels, asset.policy_summary.approval_status
    FROM asset WHERE asset.type = 'IMAGE'
  `);
  const liensCampagne = await cust.query(`
    SELECT campaign.id, campaign_asset.resource_name, campaign_asset.field_type, campaign_asset.status, asset.id, asset.name
    FROM campaign_asset
    WHERE campaign.id = ${CAMPAIGN_ID}
      AND campaign_asset.field_type = 'AD_IMAGE'
      AND campaign_asset.status != 'REMOVED'
  `);
  const liensGroupe = await cust.query(`
    SELECT campaign.id, ad_group_asset.resource_name, ad_group_asset.field_type, ad_group_asset.status, ad_group.name, asset.id, asset.name
    FROM ad_group_asset
    WHERE campaign.id = ${CAMPAIGN_ID}
      AND ad_group_asset.field_type = 'AD_IMAGE'
      AND ad_group_asset.status != 'REMOVED'
  `);
  return {
    campagne: campagne[0] ? { nom: campagne[0].campaign.name, statut: enums.CampaignStatus[campagne[0].campaign.status] } : null,
    groupes: groupes.map((r) => ({ id: String(r.ad_group.id), nom: r.ad_group.name, resourceName: r.ad_group.resource_name })),
    assets: assets.map((r) => ({
      id: String(r.asset.id),
      nom: r.asset.name,
      resourceName: r.asset.resource_name,
      taille: `${r.asset.image_asset?.full_size?.width_pixels}×${r.asset.image_asset?.full_size?.height_pixels}`,
      approbation: enums.PolicyApprovalStatus[r.asset.policy_summary?.approval_status] ?? "?",
    })),
    liensCampagne: liensCampagne.map((r) => ({ champ: enums.AssetFieldType[r.campaign_asset.field_type], assetId: String(r.asset.id), assetNom: r.asset.name })),
    liensGroupe: liensGroupe.map((r) => ({ groupe: r.ad_group.name, champ: enums.AssetFieldType[r.ad_group_asset.field_type], assetId: String(r.asset.id), assetNom: r.asset.name })),
  };
}

const afficher = (etat, titre) => {
  console.log(`\n── ${titre} ──`);
  if (etat.campagne) console.log(`Campagne : ${etat.campagne.nom} · ${etat.campagne.statut}`);
  console.log(`  groupes : ${etat.groupes.map((g) => g.nom).join(" · ")}`);
  console.log(`  assets IMAGE du compte : ${etat.assets.length}`);
  for (const a of etat.assets) console.log(`    ${a.id} « ${a.nom} » ${a.taille} · ${a.approbation}`);
  console.log(`  images liées à la campagne : ${etat.liensCampagne.length}`);
  for (const l of etat.liensCampagne) console.log(`    ${l.champ} ← « ${l.assetNom} »`);
  console.log(`  images liées à un groupe : ${etat.liensGroupe.length}`);
  for (const l of etat.liensGroupe) console.log(`    ${l.groupe} · ${l.champ} ← « ${l.assetNom} »`);
};

const avant = await lireEtat();
if (!avant.campagne) { console.error(`✗ campagne ${CAMPAIGN_ID} introuvable dans ${CUSTOMER}`); process.exit(1); }
afficher(avant, "État avant");

/* ── 3. Plan ───────────────────────────────────────────────────────────────── */
const trouverGroupe = (cle) => {
  const c = cle.toLowerCase();
  const hits = avant.groupes.filter((g) => g.nom.toLowerCase().includes(c));
  if (hits.length !== 1) throw new Error(`groupe « ${cle} » : ${hits.length} correspondance(s) parmi ${avant.groupes.map((g) => g.nom).join(", ")}`);
  return hits[0];
};

const ops = [];
const plan = [];
const campagneRN = ResourceNames.campaign(CUSTOMER, CAMPAIGN_ID);
let tmp = -1;
for (const p of prepares) {
  const cible = NIVEAU === "groupe" ? trouverGroupe(p.groupe) : null;
  const existant = avant.assets.find((a) => a.nom === p.nom);
  const dejaLie = NIVEAU === "groupe"
    ? avant.liensGroupe.some((l) => l.groupe === cible.nom && l.assetNom === p.nom)
    : avant.liensCampagne.some((l) => l.assetNom === p.nom);
  if (existant && dejaLie) { plan.push({ nom: p.nom, action: "déjà en place" }); continue; }

  let assetRN = existant?.resourceName;
  if (!assetRN) {
    assetRN = ResourceNames.asset(CUSTOMER, String(tmp--));
    ops.push({
      entity: "asset",
      operation: "create",
      resource: { resource_name: assetRN, name: p.nom, type: enums.AssetType.IMAGE, image_asset: { data: p.buffer } },
    });
  }
  if (NIVEAU === "groupe") {
    ops.push({ entity: "ad_group_asset", operation: "create", resource: { ad_group: cible.resourceName, asset: assetRN, field_type: p.champ } });
  } else {
    ops.push({ entity: "campaign_asset", operation: "create", resource: { campaign: campagneRN, asset: assetRN, field_type: p.champ } });
  }
  plan.push({ nom: p.nom, action: existant ? "lier l'asset existant" : "créer et lier", cible: cible?.nom ?? "campagne", champ: p.champNom, taille: `${p.largeurSortie}×${p.hauteurSortie}`, ko: p.ko });
}

console.log("\n── Plan ──");
for (const x of plan) console.log(`  ${x.action} · ${x.nom}${x.cible ? ` → ${x.cible} (${x.champ})` : ""}`);
if (!ops.length) console.log("  rien à faire : tout est déjà en place.");

const dossier = {
  date: new Date().toISOString(), client: m.client, customer: CUSTOMER, campaignId: CAMPAIGN_ID, niveau: NIVEAU,
  manifeste: basename(MANIFEST), avant, plan, applique: false, apres: null,
};

if (!GO || !ops.length) {
  writeFileSync(OUT, JSON.stringify(dossier, null, 2));
  console.log(`\n${GO ? "" : "Lecture seule — relancer avec --go pour envoyer. "}Dossier : ${OUT}`);
  process.exit(0);
}

/* ── 4. Envoi, tout ou rien ────────────────────────────────────────────────── */
console.log(`\n${ops.length} opérations à envoyer…`);
try {
  await cust.mutateResources(ops, { partial_failure: false });
  console.log("✓ envoyé.");
} catch (e) {
  const msg = e?.errors?.map((x) => `${x.message}${x.trigger?.string_value ? ` (${x.trigger.string_value})` : ""}`).join(" | ") || e?.message || String(e);
  console.error(`✗ échec, rien n'est appliqué : ${msg}`);
  dossier.erreur = msg;
  writeFileSync(OUT, JSON.stringify(dossier, null, 2));
  console.log(`Dossier (avec l'erreur) : ${OUT}`);
  process.exit(1);
}

/* ── 5. Relecture ──────────────────────────────────────────────────────────── */
const apres = await lireEtat();
afficher(apres, "État après");
const attendus = prepares.map((p) => p.nom);
const liens = NIVEAU === "groupe" ? apres.liensGroupe : apres.liensCampagne;
const manquants = attendus.filter((n) => !liens.some((l) => l.assetNom === n));
console.log(`\nContrôle : ${attendus.length - manquants.length}/${attendus.length} images liées${manquants.length ? ` — manquent : ${manquants.join(", ")}` : " ✓"}`);
dossier.applique = true;
dossier.apres = apres;
writeFileSync(OUT, JSON.stringify(dossier, null, 2));
console.log(`Dossier : ${OUT}`);
if (manquants.length) process.exit(2);
