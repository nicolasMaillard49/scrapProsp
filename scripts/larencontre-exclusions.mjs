/**
 * La Rencontre — pose les exclusions de campagne issues du releve J+1 du 04/09/2026.
 *
 * Le premier jour de diffusion (03/09) a fait 171 impressions pour 5,83 EUR, dont
 * 53 % hors cible : 70 des 117 termes declenches sont des marques concurrentes
 * (2,10 EUR, le clic le plus cher de la journee sur « tupina bordeaux ») et 8
 * nomment une autre commune (1,00 EUR sur « restaurant terrasse talence »).
 *
 * Les termes sont lus dans le fichier de proposition, pas ecrits ici : la liste
 * est une donnee d'audit, revisable, pas du code.
 *
 * En correspondance d'EXPRESSION, et non large comme les 27 du montage. Un mot
 * cle a exclure ne matche pas les variantes proches — ni accents, ni singulier /
 * pluriel — et une exclusion large exige que TOUS ses mots soient presents :
 * c'est pour cela que « les mauvais garcons bordeaux » n'a bloque ni « mauvais
 * garcon bordeaux » ni sa version accentuee, et que « osteria palatino » a laisse
 * passer « palatino bordeaux ». Les variantes sont donc listees une a une.
 *
 * Dedoublonne sur (texte normalise, type) contre ce qui est deja dans la
 * campagne, et n'ajoute rien d'autre : aucun budget, aucune enchere, aucun etat
 * de campagne n'est touche.
 *
 *   cd C:/Users/n.maillard/VueJS/scrapProsp
 *   node --import tsx scripts/larencontre-exclusions.mjs        # controle, valide chez Google sans ecrire
 *   node --import tsx scripts/larencontre-exclusions.mjs --go   # applique
 */
import { readFileSync } from "fs";

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

const { enums } = await import("google-ads-api");
const { clientCustomer } = await import("../app/lib/googleAds/client.ts");

const CUSTOMER = "4040541764";
const CAMPAIGN = "24197703801";
/* `--source <json>` pour une vague ulterieure (la deuxieme : exclusions-proposees-2026-09-10.json). */
const iSource = process.argv.indexOf("--source");
const SOURCE = iSource > -1 && process.argv[iSource + 1]
  ? process.argv[iSource + 1]
  : "C:/Users/n.maillard/audit-nmf/la-rencontre/data/exclusions-proposees-2026-09-04.json";
const GO = process.argv.includes("--go");
console.log(`Source : ${SOURCE}`);

/* ── La liste ──────────────────────────────────────────────────────────────── */
const prop = JSON.parse(readFileSync(SOURCE, "utf8"));
const BLOCS = ["marques_concurrentes", "communes_hors_bordeaux", "hors_offre"];

/*
 * Casse et espaces seulement : surtout PAS de depouillement des accents. Google
 * traite \u00ab les droles \u00bb et \u00ab les dr\u00f4les \u00bb comme deux exclusions differentes \u2014
 * c'est toute la raison d'etre de cette liste. Normaliser les accents ici
 * effacerait la moitie des variantes qu'on vient poser.
 */
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

const voulus = [];
for (const bloc of BLOCS) {
  const b = prop[bloc];
  if (!b) { console.error(`! bloc « ${bloc} » absent du fichier source`); process.exit(1); }
  for (const texte of b.termes) voulus.push({ texte: texte.trim(), type: b.match_type, bloc });
}

/* ── Controles avant tout envoi ────────────────────────────────────────────── */
let fautes = 0;
const dire = (m) => { console.error(`x ${m}`); fautes++; };
for (const v of voulus) {
  if (!v.texte) dire("terme vide");
  if (v.texte.length > 80) dire(`« ${v.texte} » : ${v.texte.length} caracteres, Google plafonne a 80`);
  if (v.texte.split(/\s+/).length > 10) dire(`« ${v.texte} » : plus de 10 mots, Google refusera`);
  if (!enums.KeywordMatchType[v.type]) dire(`« ${v.texte} » : type « ${v.type} » inconnu`);
}
if (fautes) { console.error(`\n${fautes} faute(s). Rien n'a ete envoye.`); process.exit(1); }

/* ── Ce qui est deja en place ──────────────────────────────────────────────── */
const cust = clientCustomer(CUSTOMER);
const lignes = await cust.query(`
  SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type,
         campaign.name
  FROM campaign_criterion
  WHERE campaign.id = ${CAMPAIGN} AND campaign_criterion.negative = TRUE
    AND campaign_criterion.type = 'KEYWORD'`);
const nomCampagne = lignes[0]?.campaign?.name;
const dejaLa = new Set(lignes.map((l) =>
  `${norm(l.campaign_criterion.keyword.text)}|${l.campaign_criterion.keyword.match_type}`));

console.log(`\nCampagne « ${nomCampagne} » (${CAMPAIGN}) du compte ${CUSTOMER}`);
console.log(`Exclusions deja en place : ${lignes.length}`);

/* ── Dedoublonnage : contre l'existant ET contre la liste elle-meme ────────── */
const vus = new Set();
const aPoser = [];
const ignores = [];
for (const v of voulus) {
  const cle = `${norm(v.texte)}|${enums.KeywordMatchType[v.type]}`;
  if (dejaLa.has(cle)) { ignores.push(`${v.texte} (deja dans la campagne)`); continue; }
  if (vus.has(cle)) { ignores.push(`${v.texte} (doublon dans la liste)`); continue; }
  vus.add(cle);
  aPoser.push(v);
}

for (const bloc of BLOCS) {
  const n = aPoser.filter((v) => v.bloc === bloc).length;
  console.log(`  . ${bloc.padEnd(24)} ${String(n).padStart(3)} a poser`);
}
if (ignores.length) console.log(`  . ignores : ${ignores.length} — ${ignores.join(", ")}`);
console.log(`\nTotal a poser : ${aPoser.length} exclusions en correspondance d'expression.`);
if (!aPoser.length) { console.log("Rien a faire."); process.exit(0); }

const ops = aPoser.map((v) => ({
  entity: "campaign_criterion",
  operation: "create",
  resource: {
    campaign: `customers/${CUSTOMER}/campaigns/${CAMPAIGN}`,
    negative: true,
    keyword: { text: v.texte, match_type: enums.KeywordMatchType[v.type] },
  },
}));

/* ── Validation chez Google, systematique, avant toute ecriture ────────────── */
console.log("\nValidation chez Google (validate_only)...");
try {
  await cust.mutateResources(ops, { validate_only: true });
  console.log(`  ok — les ${ops.length} operations sont acceptees`);
} catch (e) {
  const m = e?.errors?.map((x) => x.message).join(" | ") || e?.message || String(e);
  console.error(`  x refus a la validation : ${m}`);
  process.exit(1);
}

if (!GO) {
  console.log("\nControle seul : RIEN n'a ete ecrit chez Google. Relancer avec --go pour appliquer.");
  process.exit(0);
}

/* ── Envoi ─────────────────────────────────────────────────────────────────── */
console.log("\nEnvoi...");
const res = await cust.mutateResources(ops, { partial_failure: true });
const rejet = res?.partial_failure_error?.message;
if (rejet) console.error(`! echecs partiels : ${rejet}`);
const poses = (res?.mutate_operation_responses || []).filter((r) => r?.campaign_criterion_result).length;
console.log(`${poses} exclusion(s) posee(s).`);

/* ── Verification apres coup ───────────────────────────────────────────────── */
const apres = await cust.query(`
  SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
  FROM campaign_criterion
  WHERE campaign.id = ${CAMPAIGN} AND campaign_criterion.negative = TRUE
    AND campaign_criterion.type = 'KEYWORD'`);
const parType = apres.reduce((a, l) => {
  const t = l.campaign_criterion.keyword.match_type;
  a[t] = (a[t] || 0) + 1;
  return a;
}, {});
console.log(`\nRelu chez Google : ${apres.length} exclusions sur la campagne ` +
  `(${lignes.length} avant), dont ${parType[3] || 0} en expression et ${parType[4] || 0} en large.`);
