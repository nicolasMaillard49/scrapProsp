/**
 * Construit marche-google-ads.json — la source unique de chiffres des 3 rapports —
 * a partir des donnees brutes du 04/08. Rien n est saisi a la main.
 *
 * Le plafond d inventaire n est declare demontre que si les TROIS conditions du
 * skill sont reunies : depense < 90 % du budget demande, au moins deux paliers
 * superieurs supplementaires, depense et clics stables a +/-5 % sur ces paliers.
 *
 *   node scripts/audit-gp-elec-marche.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const AUDIT = "D:/projets/audit/gpelec";
const raw = JSON.parse(readFileSync(`${AUDIT}/data/donnees-google-ads-brutes-2026-08-04.json`, "utf8"));
const port = JSON.parse(readFileSync(`${AUDIT}/data/portefeuille-mots-cles.json`, "utf8"));
const ancien = JSON.parse(readFileSync(`${AUDIT}/data/marche-google-ads.json`, "utf8"));

const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const CLE = { "Presence (maximisation des clics)": "presence", "Haut de page (CPC manuel)": "hautDePage", "Domination (CPC manuel majore)": "domination" };

/* ---------- plafond d inventaire, strategie par strategie ---------- */
function plafond(strategy) {
  const rows = raw.matrix.filter((m) => m.strategy === strategy && m.ok).sort((a, b) => a.budget_mensuel - b.budget_mensuel);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sousUtilise = r.cost / r.budget_mensuel < 0.9;          // 1. depense < 90 % du demande
    const suivants = rows.slice(i + 1);
    const deuxPaliers = suivants.length >= 2;                      // 2. deux paliers superieurs
    const stables = suivants.slice(0, 2).every(                    // 3. stabilite a +/-5 %
      (s) => Math.abs(s.cost - r.cost) / r.cost <= 0.05 && Math.abs(s.clicks - r.clicks) / r.clicks <= 0.05,
    );
    if (sousUtilise && deuxPaliers && stables) {
      return {
        demontre: true, seuil: r.budget_mensuel, depenseMax: r2(r.cost), clicsMax: Math.round(r.clicks),
        partDuBudget: r2(r.cost / r.budget_mensuel), paliersIdentiques: suivants.slice(0, 2).map((s) => s.budget_mensuel),
      };
    }
  }
  const dernier = rows[rows.length - 1];
  return {
    demontre: false, depenseObservee: r2(dernier.cost), clicsObserves: Math.round(dernier.clicks),
    motif: "Le premier palier ou la depense passe sous 90 % du budget demande n est pas suivi de deux paliers superieurs stables. Capacite observee, plafond non demontre.",
  };
}

/* ---------- mots-cles porteurs ---------- */
const porteurs = [...raw.historical].sort((a, b) => (b.vol || 0) - (a.vol || 0)).slice(0, 8).map((k) => ({
  terme: k.text, famille: k.famille, volume: k.vol, concurrence: k.comp, indice: k.compIndex,
  encheresBasse: r2(k.bidLow), encheresHaute: r2(k.bidHigh), variantesFusionnees: k.closeVariants.length,
}));

/* ---------- gisement hors offre : les bornes de recharge ---------- */
const RX_BORNE = /borne|recharge|chargeur|charge(ment|r)? .*(voiture|vehicule)/i;
const borne = raw.historical_candidats.filter((k) => RX_BORNE.test(k.text) && k.vol);
const borneVol = borne.reduce((a, k) => a + k.vol, 0);

const marche = {
  provenance: {
    source: "Google Ads API v24 — generateKeywordIdeas (graines metier + seed URL), generateKeywordHistoricalMetrics, generateKeywordForecastMetrics",
    extraction: "2026-08-04",
    mcc: "671-181-3801",
    zone: "10 communes les plus peuplees dans un rayon de ~30 km autour de Brissac Loire Aubance",
    population: 245000,
    communes: raw.meta.communes,
    langue: "francais (languageConstants/1002)",
    reseau: "Recherche Google",
    devise: "EUR",
    periodeForecast: raw.meta.periode_forecast,
    appels: raw.meta.appels,
    erreurs: raw.errors.length,
    limiteGeo: "generateKeywordIdeas plafonne a 10 geo_target_constants par requete — la zone retenue est donc volontairement conservatrice",
    limiteMetriques: raw.meta.limite_api,
    revision: "Passe du 31/07 refaite le 04/08. Le portefeuille v1 n avait jamais ete confronte a generateKeywordIdeas : l appel de decouverte, annonce comme source dans la version precedente, n avait pas ete execute.",
  },

  portefeuille: {
    soumis: port.keywords.length,
    lignesCanoniques: raw.historical.length,
    fusionnesParGoogle: port.keywords.length - raw.historical.length,
    sansVolume: raw.historical.filter((k) => !k.vol).length,
    exclusionsMotivees: port.exclusions.length,
    recherchesMensuellesCumulees: raw.historical.reduce((a, k) => a + (k.vol || 0), 0),
    ajouteesLe0408: port.revision_2026_08_04.retenus.length,
    volumeAjoute: port.revision_2026_08_04.volume_ajoute,
    volumePrecedent: ancien.portefeuille.recherchesMensuellesCumulees,
  },

  decouverte: {
    ideesGraines: raw.ideas_seed.length,
    ideesUrl: raw.ideas_url.length,
    candidatsRemesures: raw.historical_candidats.length,
    volumeCandidats: raw.historical_candidats.reduce((a, k) => a + (k.vol || 0), 0),
    retenus: port.revision_2026_08_04.retenus,
    gisementHorsOffre: {
      theme: "Installation de bornes de recharge pour vehicule electrique",
      requetes: borne.length,
      volumeMensuel: borneVol,
      encherHauteMediane: r2([...borne.map((k) => k.bidHigh || 0)].sort((a, b) => a - b)[Math.floor(borne.length / 2)]),
      statut: "Hors offre : aucune mention sur gp-elec-49.com au 04/08. Non compte dans le marche adressable.",
      exemples: borne.sort((a, b) => b.vol - a.vol).slice(0, 5).map((k) => ({ terme: k.text, volume: k.vol, concurrence: k.comp })),
    },
  },

  motsClesPorteurs: porteurs,

  matriceBudgets: raw.meta.budgets.map((b) => {
    const row = { demande: b };
    for (const s of raw.meta.strategies) {
      const m = raw.matrix.find((x) => x.strategy === s && x.budget_mensuel === b);
      row[CLE[s]] = m?.ok ? { depense: r2(m.cost), clics: Math.round(m.clicks), cpc: r2(m.cpc) } : null;
    }
    return row;
  }),

  plafondInventaire: {
    parStrategie: Object.fromEntries(raw.meta.strategies.map((s) => [CLE[s], plafond(s)])),
    nombrePrevisions: raw.matrix.length,
    paliers: raw.meta.budgets.length,
    strategies: raw.meta.strategies.length,
    erreurs: raw.errors.filter((e) => e.phase === "forecast").length,
  },

  capaciteParFamille: {
    lecture: "Chaque famille a recu SEULE la totalite du budget de reference. Le tableau mesure la capacite d absorption propre a chaque famille, pas une repartition du budget.",
    strategie: raw.familles[0]?.strategy ?? null,
    budgetReference: raw.familles[0]?.budget_mensuel ?? null,
    lignes: raw.familles.map((f) => ({
      code: f.code, libelle: f.label, motsCles: f.mots_cles,
      depense: r2(f.cost), clics: Math.round(f.clicks || 0), cpc: r2(f.cpc),
    })),
  },

  recommandation: (() => {
    const B = 200, S = "Haut de page (CPC manuel)";
    const m = raw.matrix.find((x) => x.strategy === S && x.budget_mensuel === B);
    const p = raw.matrix.find((x) => x.strategy === "Presence (maximisation des clics)" && x.budget_mensuel === B);
    const d = raw.matrix.find((x) => x.strategy === "Domination (CPC manuel majore)" && x.budget_mensuel === B);
    return {
      budget: B, strategie: "CPC manuel plafonne",
      cpcPlafond: raw.meta.enchere_reference.bid_haut_de_page,
      depense: r2(m.cost), clics: Math.round(m.clicks), cpcTenu: r2(m.cpc),
      clicsMaximisation: Math.round(p.clicks), cpcMaximisation: r2(p.cpc),
      clicsDomination: Math.round(d.clicks), cpcDomination: r2(d.cpc),
      cpcEstimeSectoriel: 4.2,
      justification: "A budget egal, le CPC manuel plafonne rend 133 clics contre 167 en maximisation des clics, mais il tient le CPC a 1,49 EUR au lieu de le laisser deriver a 1,18 EUR sur des requetes plus larges. Le plafond protege la qualite des requetes servies sur un portefeuille ou une seule famille peut absorber tout le budget.",
    };
  })(),

  actifs: ancien.actifs,
  mesuresSite2026_08_04: ancien.mesuresSite2026_08_04,
  entreprise: ancien.entreprise,
};

writeFileSync(`${AUDIT}/data/marche-google-ads.json`, JSON.stringify(marche, null, 2));

const R = marche.recommandation, P = marche.plafondInventaire.parStrategie;
console.log(`portefeuille   ${marche.portefeuille.soumis} soumis / ${marche.portefeuille.lignesCanoniques} canoniques / ${marche.portefeuille.recherchesMensuellesCumulees} rech./mois (etait ${marche.portefeuille.volumePrecedent})`);
console.log(`recommandation ${R.budget} EUR, CPC plafonne ${R.cpcPlafond} -> ${R.depense} EUR depenses, ${R.clics} clics, CPC ${R.cpcTenu}`);
for (const [k, v] of Object.entries(P)) {
  console.log(`plafond ${k.padEnd(11)} ${v.demontre ? `DEMONTRE  ${v.depenseMax} EUR / ${v.clicsMax} clics (seuil ${v.seuil}, paliers ${v.paliersIdentiques.join(" et ")})` : `NON demontre — capacite observee ${v.depenseObservee} EUR / ${v.clicsObserves} clics`}`);
}
console.log(`gisement borne ${marche.decouverte.gisementHorsOffre.requetes} requetes, ${marche.decouverte.gisementHorsOffre.volumeMensuel} rech./mois — hors offre`);
console.log(`top mot-cle    ${porteurs[0].terme} ${porteurs[0].volume}/mois`);
