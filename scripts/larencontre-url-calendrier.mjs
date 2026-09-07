/**
 * La Rencontre — les annonces atterrissent sur l'accueil, et la campagne ne
 * diffuse plus dimanche ni lundi.
 *
 * Deux constats du 07/09/2026, campagne `Recherche - La Rencontre Soir`
 * (24197703801, compte 404-054-1764) :
 *
 *   1. Les trois annonces envoyaient sur `/reservation` : un formulaire nu, sans
 *      photo ni avis, qui ne répond à aucune des trois intentions (italien,
 *      gastronomique, découverte). Le relevé J+1 lui attribue le Quality Score
 *      à 1–3. L'accueil montre la devanture, « Plus de 150 avis », les plats,
 *      et un bouton Réserver collant : c'est lui qui donne envie. Le tracking
 *      ne casse pas — Réserver mène à `/reservation`, où part `generate_lead`.
 *
 *   2. Le planning en prod (`/public/schedule`) sert mardi soir (depuis le
 *      21/07, jusqu'au 31/12) et mercredi→samedi midi et soir. Dimanche et
 *      lundi sont fermés. Diffuser ces deux soirs-là envoyait des clics à 1 €
 *      vers « Pas de créneaux disponibles à cette date ». Le script de montage
 *      avait gardé les 7 jours en pariant sur ceux qui anticipent ; la fenêtre
 *      17 h–22 h cible pourtant l'intention « ce soir ». On coupe DIMANCHE et
 *      LUNDI, on garde mardi→samedi 17 h–22 h.
 *
 * Le budget quotidien n'est PAS touché (4,93 €/jour) : le plafond mensuel
 * reste 150 €, et Google peut doubler sur les jours actifs pour compenser.
 *
 * Lecture seule sans drapeau : affiche l'état et le plan. `--go` applique,
 * puis relit — on ne se fie jamais au retour de l'écriture.
 *
 *   node --import tsx scripts/larencontre-url-calendrier.mjs
 *   node --import tsx scripts/larencontre-url-calendrier.mjs --go
 *
 * Écrit `C:/Users/n.maillard/audit-nmf/la-rencontre/data/changement-url-calendrier-AAAA-MM-JJ.json`
 * (état avant, plan, état après) pour le dossier de suivi.
 */
import { readFileSync, writeFileSync } from "node:fs";

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
const CAMPAIGN_ID = 24197703801;
const URL_AVANT = "https://restaurantlarencontre.com/reservation";
const URL_APRES = "https://restaurantlarencontre.com/";
const JOURS_COUPES = ["SUNDAY", "MONDAY"];
const GO = process.argv.includes("--go");

const AUDIT = "C:/Users/n.maillard/audit-nmf/la-rencontre/data";
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const OUT = `${AUDIT}/changement-url-calendrier-${AUJOURDHUI}.json`;

const cust = clientCustomer(CUSTOMER);
const nomJour = (v) => enums.DayOfWeek[v] ?? String(v);

/* ── Lecture de l'état ─────────────────────────────────────────────────────── */
async function lireEtat() {
  const campagne = await cust.query(`
    SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros
    FROM campaign WHERE campaign.id = ${CAMPAIGN_ID}
  `);
  const annonces = await cust.query(`
    SELECT ad_group.name, ad_group_ad.status, ad_group_ad.ad.id,
           ad_group_ad.ad.resource_name, ad_group_ad.ad.final_urls,
           ad_group_ad.policy_summary.approval_status
    FROM ad_group_ad
    WHERE campaign.id = ${CAMPAIGN_ID} AND ad_group_ad.status != 'REMOVED'
  `);
  const plages = await cust.query(`
    SELECT campaign_criterion.resource_name, campaign_criterion.ad_schedule.day_of_week,
           campaign_criterion.ad_schedule.start_hour, campaign_criterion.ad_schedule.end_hour
    FROM campaign_criterion
    WHERE campaign.id = ${CAMPAIGN_ID} AND campaign_criterion.type = 'AD_SCHEDULE'
  `);
  return {
    campagne: campagne[0]
      ? {
          nom: campagne[0].campaign.name,
          statut: enums.CampaignStatus[campagne[0].campaign.status],
          budgetJourEuros: Number(campagne[0].campaign_budget.amount_micros) / 1e6,
        }
      : null,
    annonces: annonces.map((r) => ({
      groupe: r.ad_group.name,
      adId: String(r.ad_group_ad.ad.id),
      resourceName: r.ad_group_ad.ad.resource_name,
      finalUrls: r.ad_group_ad.ad.final_urls,
      statut: enums.AdGroupAdStatus[r.ad_group_ad.status],
      approbation: enums.PolicyApprovalStatus[r.ad_group_ad.policy_summary?.approval_status],
    })),
    plages: plages.map((r) => ({
      resourceName: r.campaign_criterion.resource_name,
      jour: nomJour(r.campaign_criterion.ad_schedule.day_of_week),
      de: r.campaign_criterion.ad_schedule.start_hour,
      a: r.campaign_criterion.ad_schedule.end_hour,
    })),
  };
}

const afficher = (etat, titre) => {
  console.log(`\n── ${titre} ──`);
  if (etat.campagne) {
    console.log(`Campagne : ${etat.campagne.nom} · ${etat.campagne.statut} · ${etat.campagne.budgetJourEuros.toFixed(2)} €/jour`);
  }
  for (const a of etat.annonces) {
    console.log(`  annonce ${a.adId} (${a.groupe}) · ${a.statut} · ${a.approbation} → ${a.finalUrls.join(", ")}`);
  }
  console.log(`  calendrier : ${etat.plages.map((p) => `${p.jour} ${p.de}h–${p.a}h`).join(" · ") || "aucun (24/7)"}`);
};

const avant = await lireEtat();
if (!avant.campagne) {
  console.error(`✗ campagne ${CAMPAIGN_ID} introuvable dans ${CUSTOMER}`);
  process.exit(1);
}
afficher(avant, "État avant");

/* ── Plan ──────────────────────────────────────────────────────────────────── */
const ops = [];
const plan = { urls: [], plagesSupprimees: [] };

for (const a of avant.annonces) {
  if (a.finalUrls.length === 1 && a.finalUrls[0] === URL_APRES) continue;
  if (!a.finalUrls.includes(URL_AVANT)) {
    console.log(`  ! annonce ${a.adId} (${a.groupe}) pointe ailleurs (${a.finalUrls.join(", ")}) : laissée telle quelle`);
    continue;
  }
  plan.urls.push({ adId: a.adId, groupe: a.groupe, de: a.finalUrls, vers: [URL_APRES] });
  ops.push({
    entity: "ad",
    operation: "update",
    resource: { resource_name: a.resourceName, final_urls: [URL_APRES] },
  });
}

for (const p of avant.plages) {
  if (!JOURS_COUPES.includes(p.jour)) continue;
  plan.plagesSupprimees.push(p);
  ops.push({ entity: "campaign_criterion", operation: "remove", resource: p.resourceName });
}

console.log("\n── Plan ──");
for (const u of plan.urls) console.log(`  URL finale annonce ${u.adId} (${u.groupe}) : ${u.de.join(", ")} → ${u.vers.join(", ")}`);
for (const p of plan.plagesSupprimees) console.log(`  retirer la plage ${p.jour} ${p.de}h–${p.a}h`);
if (!ops.length) console.log("  rien à faire : l'état cible est déjà en place.");

const dossier = { date: new Date().toISOString(), campaignId: CAMPAIGN_ID, customer: CUSTOMER, avant, plan, applique: false, apres: null };

if (!GO || !ops.length) {
  writeFileSync(OUT, JSON.stringify(dossier, null, 2));
  console.log(`\n${GO ? "" : "Lecture seule — relancer avec --go pour appliquer. "}Dossier : ${OUT}`);
  process.exit(0);
}

/* ── Écriture, tout ou rien ────────────────────────────────────────────────── */
console.log(`\n${ops.length} opérations à envoyer…`);
try {
  const res = await cust.mutateResources(ops, { partial_failure: false });
  console.log(`✓ ${res?.mutate_operation_responses?.length ?? res?.results?.length ?? ops.length} opérations passées.`);
} catch (e) {
  const msg = e?.errors?.map((x) => x.message).join(" | ") || e?.message || String(e);
  console.error(`✗ échec, rien n'est appliqué : ${msg}`);
  process.exit(1);
}

/* ── Relecture ─────────────────────────────────────────────────────────────── */
const apres = await lireEtat();
afficher(apres, "État après");

const urlsOk = apres.annonces.every((a) => a.finalUrls.length === 1 && a.finalUrls[0] === URL_APRES);
const joursOk = !apres.plages.some((p) => JOURS_COUPES.includes(p.jour));
const budgetOk = apres.campagne.budgetJourEuros === avant.campagne.budgetJourEuros;
const statutOk = apres.campagne.statut === avant.campagne.statut;
console.log(`\nContrôles : URLs ${urlsOk ? "✓" : "✗"} · dimanche/lundi retirés ${joursOk ? "✓" : "✗"} · budget intact ${budgetOk ? "✓" : "✗"} · statut intact ${statutOk ? "✓" : "✗"}`);

dossier.applique = true;
dossier.apres = apres;
writeFileSync(OUT, JSON.stringify(dossier, null, 2));
console.log(`Dossier : ${OUT}`);
if (!(urlsOk && joursOk && budgetOk && statutOk)) process.exit(2);
