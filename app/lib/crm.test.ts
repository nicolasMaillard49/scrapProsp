import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_STATUSES, parseClientStatus, clientTone, isClosed, countsAsRevenue,
  progress, nextRank, parseChecklistPaste, normalizeUrl, cleanText, parseTarif,
  clientFromProspect, crmTotals, messageErreur, waLink, memeValeur,
  nextAction, lastActivityAt, daysSince, isStale, relativeFr, groupByStatus, sumTarif, STALE_DAYS,
  moisDe, moisFr, etatFacture, enSupervision, mrr, supervisionSummary, prochainePeriode,
  echeanceDe, parseJourEcheance, moisPrecedents, type Invoice,
} from "./crm";
import { SERVICES, serviceByCode, totalPrestations, etapesAAjouter, livrablesManquants } from "./crmServices";
import { MISSION_TEMPLATES, templateById } from "./crmTemplates";

// ── Statuts ────────────────────────────────────────────────────────────────

test("parseClientStatus n'accepte QUE les statuts connus", () => {
  for (const s of CLIENT_STATUSES) assert.equal(parseClientStatus(s), s);
  assert.equal(parseClientStatus("EN_COURS"), "en_cours"); // casse tolérée
  assert.equal(parseClientStatus(" piste "), "piste");
  assert.equal(parseClientStatus("accroche"), null); // un stade IG n'est pas un statut client
  assert.equal(parseClientStatus(""), null);
  assert.equal(parseClientStatus(undefined), null);
});

test("le CA engagé ignore les pistes et les perdus", () => {
  assert.ok(!countsAsRevenue("piste")); // il a dit oui à un audit, pas à un devis
  assert.ok(!countsAsRevenue("perdu"));
  assert.ok(countsAsRevenue("en_cours"));
  assert.ok(countsAsRevenue("en_attente")); // bloqué chez lui, mais engagé
  assert.ok(countsAsRevenue("livre"));
  assert.ok(countsAsRevenue("termine"));
});

test("seuls terminé et perdu ferment le dossier", () => {
  assert.ok(isClosed("termine"));
  assert.ok(isClosed("perdu"));
  assert.ok(!isClosed("livre")); // livré ≠ fini : on mesure encore
  assert.ok(!isClosed("en_attente"));
  assert.equal(clientTone("en_attente"), "wait");
  assert.equal(clientTone("termine"), "won");
  assert.equal(clientTone("inconnu"), "progress"); // repli, jamais une exception
});

// ── Progression ────────────────────────────────────────────────────────────

test("une checklist VIDE est à 0 %, jamais à 100 %", () => {
  assert.deepEqual(progress([]), { done: 0, total: 0, pct: 0 });
  assert.deepEqual(progress([{ done: true }, { done: false }]), { done: 1, total: 2, pct: 50 });
  assert.deepEqual(progress([{ done: true }]), { done: 1, total: 1, pct: 100 });
  assert.equal(progress([{ done: true }, { done: false }, { done: false }]).pct, 33);
});

test("nextRank ajoute à la SUITE, même si les rangs sont troués", () => {
  assert.equal(nextRank([]), 0);
  assert.equal(nextRank([{ rank: 0 }, { rank: 7 }, { rank: 3 }]), 8);
});

// ── Collage de checklist ───────────────────────────────────────────────────

test("parseChecklistPaste avale une liste IA telle quelle", () => {
  const colle = `## Cadrage
- Récupérer la zone d'intervention
* Valider le budget
1. Créer le compte Google Ads
2) Poser le tracking d'appel
- [ ] Écrire les annonces
- [x] Lancer la campagne
**Bilan J+7**
---

`;
  assert.deepEqual(parseChecklistPaste(colle), [
    "Récupérer la zone d'intervention",
    "Valider le budget",
    "Créer le compte Google Ads",
    "Poser le tracking d'appel",
    "Écrire les annonces",
    "Lancer la campagne",
    "Bilan J+7",
  ]);
});

test("parseChecklistPaste : titres, séparateurs et lignes vides ne deviennent pas des étapes", () => {
  assert.deepEqual(parseChecklistPaste("# Mission\n\n***\n  \n- Poser le tracking"), ["Poser le tracking"]);
  assert.deepEqual(parseChecklistPaste(""), []);
  // Une ligne d'un seul caractère n'est pas une étape (reste de puce mal collée).
  assert.deepEqual(parseChecklistPaste("- x\n- Vraie étape"), ["Vraie étape"]);
});

// ── Saisie ─────────────────────────────────────────────────────────────────

test("normalizeUrl : un domaine nu devient un lien ABSOLU", () => {
  // Sans schéma, le navigateur résoudrait `/crm/<id>/nmf-agence.com`.
  assert.equal(normalizeUrl("nmf-agence.com"), "https://nmf-agence.com");
  assert.equal(normalizeUrl("www.nmf-agence.com"), "https://www.nmf-agence.com");
  assert.equal(normalizeUrl("https://deja.fr/page"), "https://deja.fr/page");
  assert.equal(normalizeUrl("  "), null);
  assert.equal(normalizeUrl("pas une url"), null);
});

test("cleanText rend null et jamais une chaîne vide", () => {
  assert.equal(cleanText("  "), null);
  assert.equal(cleanText("Nicolas"), "Nicolas");
  assert.equal(cleanText(null), null);
});

test("parseTarif accepte la saisie humaine, refuse le reste", () => {
  assert.equal(parseTarif("500"), 500);
  assert.equal(parseTarif("500 €"), 500);
  assert.equal(parseTarif("1 200,50"), 1200.5);
  assert.equal(parseTarif(300), 300);
  assert.equal(parseTarif(""), null);
  assert.equal(parseTarif(null), null);
  assert.equal(parseTarif("gratuit"), null); // un tarif faux est pire qu'absent
  assert.equal(parseTarif(-10), null);
});

// ── Ce que la carte dit sans être ouverte ──────────────────────────────────

test("nextAction rend la première étape NON faite, dans l'ordre des rangs", () => {
  const tasks = [
    { label: "Écrire les annonces", rank: 2, done: false },
    { label: "Récupérer la zone", rank: 0, done: true },
    { label: "Valider le budget", rank: 1, done: false },
  ];
  assert.equal(nextAction(tasks), "Valider le budget"); // rang 1, pas l'ordre du tableau
  assert.equal(nextAction(tasks.map((t) => ({ ...t, done: true }))), null); // tout est fait
  assert.equal(nextAction([]), null); // checklist vide : rien à annoncer
});

test("lastActivityAt prend la plus récente et ignore le reste", () => {
  assert.equal(
    lastActivityAt(["2026-08-01T10:00:00Z", null, "2026-08-07T09:00:00Z", undefined, "pas une date"]),
    "2026-08-07T09:00:00Z",
  );
  assert.equal(lastActivityAt([null, undefined]), null);
  assert.equal(lastActivityAt([]), null);
});

test("daysSince compte des jours pleins, et refuse une date fausse", () => {
  const now = new Date("2026-08-09T12:00:00Z");
  assert.equal(daysSince("2026-08-09T08:00:00Z", now), 0);
  assert.equal(daysSince("2026-08-06T12:00:00Z", now), 3);
  assert.equal(daysSince(null, now), null);
  assert.equal(daysSince("bientôt", now), null);
});

test("un dossier CLOS ne dort jamais, un dossier actif oui", () => {
  const now = new Date("2026-08-09T12:00:00Z");
  const vieux = "2026-07-01T12:00:00Z"; // 39 jours
  assert.ok(isStale("en_cours", vieux, now));
  assert.ok(isStale("en_attente", vieux, now));
  assert.ok(!isStale("termine", vieux, now)); // fini = immobile par nature
  assert.ok(!isStale("perdu", vieux, now));
  assert.ok(!isStale("en_cours", "2026-08-08T12:00:00Z", now)); // hier
  assert.ok(!isStale("en_cours", null, now)); // sans date, pas d'accusation
  // Le seuil est strict : pile STALE_DAYS jours ne suffit pas.
  const pile = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString();
  assert.ok(!isStale("en_cours", pile, now));
});

test("relativeFr parle en français et jamais en dates ISO", () => {
  const now = new Date("2026-08-09T12:00:00Z");
  assert.equal(relativeFr("2026-08-09T09:00:00Z", now), "aujourd'hui");
  assert.equal(relativeFr("2026-08-08T09:00:00Z", now), "hier");
  assert.equal(relativeFr("2026-08-03T12:00:00Z", now), "il y a 6 j");
  assert.equal(relativeFr("2026-07-20T12:00:00Z", now), "il y a 3 sem.");
  assert.equal(relativeFr("2026-05-09T12:00:00Z", now), "il y a 3 mois");
  assert.equal(relativeFr(null, now), "—");
});

// ── Colonnes du tableau ────────────────────────────────────────────────────

test("groupByStatus rend TOUTES les colonnes, dans l'ordre du cycle", () => {
  const cols = groupByStatus([{ statut: "en_cours" }, { statut: "piste" }, { statut: "en_cours" }]);
  assert.deepEqual(cols.map((c) => c.statut), [...CLIENT_STATUSES]);
  assert.equal(cols.find((c) => c.statut === "en_cours")!.rows.length, 2);
  // Une colonne vide reste rendue : on ne dépose pas dans ce qui n'existe pas.
  assert.equal(cols.find((c) => c.statut === "livre")!.rows.length, 0);
});

test("groupByStatus tolère la casse et écarte un statut inconnu", () => {
  const cols = groupByStatus([{ statut: "EN_COURS" }, { statut: "accroche" }]);
  assert.equal(cols.find((c) => c.statut === "en_cours")!.rows.length, 1);
  assert.equal(cols.reduce((n, c) => n + c.rows.length, 0), 1); // le stade IG n'entre nulle part
});

test("sumTarif additionne des saisies humaines et ignore le reste", () => {
  assert.equal(sumTarif([{ tarif_ht: "500 €" }, { tarif_ht: 300 }, { tarif_ht: null }, { tarif_ht: "gratuit" }]), 800);
  assert.equal(sumTarif([]), 0);
});

test("memeValeur ne signale que les VRAIES divergences", () => {
  // Même numéro, trois écritures : aucune alerte.
  assert.ok(memeValeur("telephone", "+33 6 18 96 57 36", "06 18 96 57 36"));
  assert.ok(memeValeur("telephone", "0033618965736", "06.18.96.57.36"));
  assert.ok(!memeValeur("telephone", "06 18 96 57 36", "06 18 96 57 37"));
  // Même site, à un slash et un www près.
  assert.ok(memeValeur("site_url", "https://gp-elec-49.com/", "https://gp-elec-49.com"));
  assert.ok(memeValeur("site_url", "https://www.gp-elec-49.com", "http://gp-elec-49.com/"));
  assert.ok(!memeValeur("site_url", "https://gp-elec-49.com", "https://gp-elec-49.fr"));
  assert.ok(memeValeur("email", "Pierre@Gmail.com", "pierre@gmail.com"));
  // Un champ vide d'un côté n'est pas une divergence : c'est un manque.
  assert.ok(!memeValeur("telephone", "", "06 18 96 57 36"));
  assert.ok(memeValeur("contact", "  Pierre   Guille ", "pierre guille"));
});

test("waLink met les numéros français au format international", () => {
  assert.equal(waLink("06 18 96 57 36"), "https://wa.me/33618965736");
  assert.equal(waLink("06.76.69.60.94"), "https://wa.me/33676696094");
  assert.equal(waLink("+33 6 18 96 57 36"), "https://wa.me/33618965736");
  assert.equal(waLink("0033618965736"), "https://wa.me/33618965736");
  assert.equal(waLink("+1 415 555 0123"), "https://wa.me/14155550123"); // hors France : intact
  // Un lien mort vaut moins qu'un lien absent — au moins, l'absence se voit.
  assert.equal(waLink("3615"), null);
  assert.equal(waLink(""), null);
  assert.equal(waLink(null), null);
});

// ── Supervision et factures ────────────────────────────────────────────────

const facture = (p: Partial<Invoice>): Invoice => ({
  id: p.id ?? "f", client_id: "c", periode: p.periode ?? "2026-08-01", numero: null, libelle: null,
  montant_ht: p.montant_ht ?? 29, due_date: p.due_date ?? null, paid_at: p.paid_at ?? null,
});

test("moisDe et moisFr parlent du MOIS, jamais d'un intervalle", () => {
  assert.equal(moisDe(new Date(2026, 7, 9, 12)), "2026-08-01");
  assert.equal(moisDe(new Date(2026, 0, 31, 23)), "2026-01-01"); // le mois, pas le jour
  assert.equal(moisFr("2026-08-01"), "août 2026");
  assert.equal(moisFr(null), "—");
  assert.equal(moisFr("pas une date"), "—");
});

test("le retard se mesure sur l'ÉCHÉANCE, pas sur la période", () => {
  const now = new Date("2026-09-01T12:00:00");
  // Facture d'août payable au 15 septembre : pas en retard le 1er septembre.
  assert.equal(etatFacture({ due_date: "2026-09-15" }, now), "a_echoir");
  assert.equal(etatFacture({ due_date: "2026-08-15" }, now), "en_retard");
  assert.equal(etatFacture({ due_date: "2026-08-15", paid_at: "2026-08-20T10:00:00Z" }, now), "payee");
  // Payée AVANT l'échéance : toujours payée, jamais « à échoir ».
  assert.equal(etatFacture({ due_date: "2026-12-31", paid_at: "2026-08-01T10:00:00Z" }, now), "payee");
  assert.equal(etatFacture({ due_date: null }, now), "a_echoir"); // sans échéance, rien à affirmer
});

test("la supervision se définit par l'argent mensuel, pas par le statut", () => {
  assert.ok(enSupervision({ maintenance_ht: 29 }));
  assert.ok(enSupervision({ maintenance_ht: "29 €" }));
  assert.ok(!enSupervision({ maintenance_ht: 0 }));
  assert.ok(!enSupervision({ maintenance_ht: null }));
  assert.ok(!enSupervision({}));
  assert.equal(mrr([{ maintenance_ht: 29 }, { maintenance_ht: "49" }, { maintenance_ht: null }]), 78);
});

test("supervisionSummary distingue « pas encore émis » de « impayé »", () => {
  const now = new Date("2026-09-10T12:00:00");
  const invoices = [
    facture({ id: "a", periode: "2026-07-01", due_date: "2026-07-31", paid_at: "2026-07-28T09:00:00Z" }),
    facture({ id: "b", periode: "2026-08-01", due_date: "2026-08-31" }), // échue, non réglée
  ];
  const s = supervisionSummary(invoices, now);
  assert.equal(s.courante, null); // septembre n'est PAS émis — ce n'est pas un impayé
  assert.equal(s.retards.length, 1);
  assert.equal(s.retards[0].id, "b");
  assert.equal(s.duHT, 29);
  assert.equal(s.dernierPaiement, "2026-07-01");
  // Le mois courant émis : il devient « courante », et n'est pas en retard.
  const avecSeptembre = [...invoices, facture({ id: "c", periode: "2026-09-01", due_date: "2026-09-30" })];
  const s2 = supervisionSummary(avecSeptembre, now);
  assert.equal(s2.courante?.id, "c");
  assert.equal(s2.retards.length, 1);
});

test("echeanceDe pose le jour convenu, rabattu sur les mois trop courts", () => {
  assert.equal(echeanceDe("2026-08-01", 29), "2026-08-29");
  assert.equal(echeanceDe("2026-02-01", 31), "2026-02-28"); // rabattu, jamais reporté en mars
  assert.equal(echeanceDe("2024-02-01", 30), "2024-02-29"); // bissextile
  assert.equal(echeanceDe("2026-04-01", 31), "2026-04-30");
  assert.equal(echeanceDe("2026-08-01", 1), "2026-08-01");
  assert.equal(echeanceDe("2026-08-01", null), "2026-08-31"); // repli : 30 jours
  assert.equal(echeanceDe("pas une date", 29), "pas une da"); // pas d'exception
});

test("parseJourEcheance n'accepte qu'un jour de mois", () => {
  assert.equal(parseJourEcheance("29"), 29);
  assert.equal(parseJourEcheance(1), 1);
  assert.equal(parseJourEcheance(31), 31);
  assert.equal(parseJourEcheance(0), null);
  assert.equal(parseJourEcheance(32), null);
  assert.equal(parseJourEcheance("le 5"), null);
  assert.equal(parseJourEcheance(""), null);
  assert.equal(parseJourEcheance(null), null);
});

test("moisPrecedents rend la frise dans le sens du temps, mois courant inclus", () => {
  assert.deepEqual(moisPrecedents(new Date(2026, 7, 9), 3), ["2026-06-01", "2026-07-01", "2026-08-01"]);
  // Le passage d'année se fait sans arithmétique fausse.
  assert.deepEqual(moisPrecedents(new Date(2026, 1, 3), 4), ["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"]);
});

test("prochainePeriode propose le mois COURANT, une seule fois", () => {
  const now = new Date("2026-09-10T12:00:00");
  assert.equal(prochainePeriode([], now), "2026-09-01");
  assert.equal(prochainePeriode([facture({ periode: "2026-08-01" })], now), "2026-09-01");
  assert.equal(prochainePeriode([facture({ periode: "2026-09-01" })], now), null); // déjà émis
});

// ── Catalogue de prestations ───────────────────────────────────────────────

test("le catalogue a des codes uniques et des tarifs alignés sur Agence.md", () => {
  const codes = SERVICES.map((s) => s.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(serviceByCode("site-vitrine")?.montant, 300);
  assert.equal(serviceByCode("site-reservation")?.montant, 500);
  assert.equal(serviceByCode("inconnu"), null);
});

test("une prestation apporte SES étapes, sans écraser l'existant", () => {
  const etapes = etapesAAjouter("site-vitrine", []);
  assert.ok(etapes.length >= 8);
  assert.ok(etapes.every((e) => e.label && e.phase)); // chaque étape est rangée dans une phase
  assert.equal(etapes[0].phase, "Cadrage"); // l'ordre du chantier est conservé

  // Ce qui est déjà là gagne : pas de doublon, casse et espaces ignorés.
  const deja = [{ label: "  RÉCUPÉRER TEXTES, PHOTOS ET LOGO DU CLIENT " }];
  const restantes = etapesAAjouter("site-vitrine", deja);
  assert.equal(restantes.length, etapes.length - 1);
  assert.ok(!restantes.some((e) => /logo du client/i.test(e.label)));

  assert.deepEqual(etapesAAjouter("inconnu", []), []); // une prestation hors catalogue n'invente rien
});

test("un livrable coché sans pièce jointe est RÉCLAMÉ", () => {
  const tasks = [
    { label: "Mesurer le site : vitesse, mobile, conversion", done: true },
    { label: "Rédiger le rapport et la recommandation chiffrée", done: true },
  ];
  const manquants = livrablesManquants(tasks, []);
  assert.equal(manquants.length, 1);
  assert.equal(manquants[0].kind, "audit");
  assert.match(manquants[0].etape, /Rédiger le rapport/);

  // La pièce présente éteint la réclamation.
  assert.deepEqual(livrablesManquants(tasks, [{ kind: "audit" }]), []);
  // Étape NON faite : on ne réclame pas un rapport avant qu'il soit écrit.
  assert.deepEqual(livrablesManquants(tasks.map((t) => ({ ...t, done: false })), []), []);
  // Une étape sans livrable attendu ne déclenche rien.
  assert.deepEqual(livrablesManquants([{ label: "Relire le compte avant diffusion", done: true }], []), []);
});

test("le total des prestations EXCLUT les mensuelles", () => {
  const lignes = [
    { code: "site-vitrine", montant_ht: 300 },
    { code: "page-supplementaire", montant_ht: "150" },
    { code: "maintenance", montant_ht: 29 }, // mensuel : jamais additionné au forfait
    { code: "ads-gestion", montant_ht: 200 }, // mensuel
  ];
  assert.equal(totalPrestations(lignes), 450);
  assert.equal(totalPrestations([{ code: "refonte", montant_ht: null }]), 0); // sur devis
  assert.equal(totalPrestations([]), 0);
});

// ── Erreurs affichables ────────────────────────────────────────────────────

test("messageErreur ne rend jamais un objet à React", () => {
  assert.equal(messageErreur({ error: "contenu requis" }, 400), "contenu requis");
  // Le corps qui a fait tomber la fiche : un serveur voisin captait le port.
  assert.equal(
    messageErreur(
      { error: { code: "POST_NOT_FOUND", message: "Cannot POST /api/crm/x/notes", correlationId: "fb3c" } },
      404,
    ),
    "Cannot POST /api/crm/x/notes",
  );
  assert.equal(messageErreur({ message: "Unauthorized" }, 401), "Unauthorized");
  assert.equal(messageErreur("Bad Gateway", 502), "Bad Gateway");
  assert.equal(messageErreur({ error: { code: 500 } }, 503), "Erreur 503"); // rien de lisible
  assert.equal(messageErreur({ error: "   " }, 500), "Erreur 500"); // un vide n'informe pas
  assert.equal(messageErreur(null, 500), "Erreur 500");
  assert.equal(messageErreur(undefined, 0), "Erreur 0");
});

// ── Reprise d'un prospect ──────────────────────────────────────────────────

test("clientFromProspect : le nom d'usage prime sur le pseudo", () => {
  const d = clientFromProspect({
    id: "p1", username: "elec_bordeaux", full_name: "GP Élec", metier: "electricien",
    ville: "Bordeaux", external_url: "gpelec.fr", profile_pic_url: "https://cdn.ig/photo.jpg",
  });
  assert.equal(d.nom, "GP Élec");
  assert.equal(d.site_url, "https://gpelec.fr");
  assert.equal(d.image_url, "https://cdn.ig/photo.jpg"); // la carte doit être reconnaissable dès la reprise
  assert.equal(d.source, "instagram");
  assert.equal(d.instagram_prospect_id, "p1");
});

test("clientFromProspect : sans nom d'usage, le pseudo fait office", () => {
  const d = clientFromProspect({ id: "p2", username: "monatelier", full_name: null });
  assert.equal(d.nom, "@monatelier");
  assert.equal(d.metier, null);
  assert.equal(d.site_url, null);
});

// ── Agrégats ───────────────────────────────────────────────────────────────

test("crmTotals sépare l'engagé de l'espoir", () => {
  const t = crmTotals([
    { statut: "en_cours", tarif_ht: 500 },
    { statut: "en_attente", tarif_ht: "300" },
    { statut: "termine", tarif_ht: 500 },
    { statut: "piste", tarif_ht: 750 },
    { statut: "perdu", tarif_ht: 500 },
    { statut: "en_cours", tarif_ht: null }, // tarif pas encore fixé
  ]);
  assert.equal(t.total, 6);
  assert.equal(t.actifs, 4); // tout sauf terminé et perdu
  assert.equal(t.bloques, 1);
  assert.equal(t.caEngage, 1300); // 500 + 300 + 500, le perdu exclu
  assert.equal(t.caPistes, 750); // jamais mélangé à l'engagé
});

// ── Modèles de mission ─────────────────────────────────────────────────────

test("les modèles sont bien formés et leurs identifiants uniques", () => {
  const ids = MISSION_TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of MISSION_TEMPLATES) {
    assert.ok(t.nom && t.resume, `${t.id} : nom et résumé requis`);
    assert.ok(t.steps.length >= 5, `${t.id} : un modèle sous 5 étapes n'en est pas un`);
    for (const s of t.steps) {
      assert.ok(s.label.trim().length > 2, `${t.id} : étape vide`);
      assert.ok(s.phase.trim().length > 0, `${t.id} : phase manquante sur « ${s.label} »`);
    }
  }
});

test("templateById refuse un identifiant inconnu", () => {
  assert.equal(templateById("landing-page")?.nom, "Landing page (mise en avant d'un service)");
  assert.equal(templateById("nawak"), null);
  assert.equal(templateById(undefined), null);
});
