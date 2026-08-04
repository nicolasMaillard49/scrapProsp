import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractEmails, extractPhonesFr, pickContact, hasRealWebsite,
  extractLastPostAt, isActiveSince, prospectScore, detectMetier,
  instagramDmSequence, instagramDmSequenceSite, firstNameOf, QUESTIONNAIRE_URL, competitorHook, isHorsCible,
} from "./instagram";

test("extractEmails: trouve, déduplique, minuscule", () => {
  assert.deepEqual(extractEmails("Contact: Jean.Dupont@Salon.FR ou jean.dupont@salon.fr"), ["jean.dupont@salon.fr"]);
  assert.deepEqual(extractEmails("rien ici"), []);
  assert.deepEqual(extractEmails(null), []);
});

test("extractPhonesFr: formats variés → national normalisé", () => {
  assert.deepEqual(extractPhonesFr("Resa 06 12 34 56 78"), ["06 12 34 56 78"]);
  assert.deepEqual(extractPhonesFr("tel: 06.12.34.56.78"), ["06 12 34 56 78"]);
  assert.deepEqual(extractPhonesFr("+33 6 12 34 56 78"), ["06 12 34 56 78"]);
  assert.deepEqual(extractPhonesFr("0033612345678"), ["06 12 34 56 78"]);
  assert.deepEqual(extractPhonesFr("pas de num"), []);
});

test("pickContact: priorité champ business, repli bio", () => {
  assert.deepEqual(
    pickContact({ businessEmail: "PRO@x.com", biography: "autre@y.fr 06 11 22 33 44" }),
    { email: "pro@x.com", phone: "06 11 22 33 44" },
  );
  assert.deepEqual(
    pickContact({ biography: "Écris-moi: hello@studio.fr — 07 99 88 77 66" }),
    { email: "hello@studio.fr", phone: "07 99 88 77 66" },
  );
  assert.deepEqual(pickContact({ biography: "no contact" }), { email: null, phone: null });
});

test("hasRealWebsite: vrai site vs agrégateur (sanity, inchangé)", () => {
  assert.equal(hasRealWebsite("https://mon-salon.fr"), true);
  assert.equal(hasRealWebsite("https://linktr.ee/x"), false);
  assert.equal(hasRealWebsite(""), false);
});

test("extractLastPostAt: prend le timestamp le plus récent de latestPosts", () => {
  const raw = { latestPosts: [{ timestamp: "2026-05-01T10:00:00.000Z" }, { timestamp: "2026-06-15T08:00:00.000Z" }, { noTs: true }] };
  assert.equal(extractLastPostAt(raw), "2026-06-15T08:00:00.000Z");
  assert.equal(extractLastPostAt({}), null);
  assert.equal(extractLastPostAt(null), null);
  assert.equal(extractLastPostAt({ latestPosts: [] }), null);
});

test("isActiveSince: fenêtre 3 mois (règle double check)", () => {
  const now = Date.parse("2026-07-01T00:00:00Z");
  assert.equal(isActiveSince("2026-06-01T00:00:00Z", 3, now), true); // 1 mois
  assert.equal(isActiveSince("2026-01-01T00:00:00Z", 3, now), false); // 6 mois
  assert.equal(isActiveSince(null, 3, now), false);
  assert.equal(isActiveSince("pas-une-date", 3, now), false);
});

test("prospectScore: cumul des signaux + tiers", () => {
  const now = Date.parse("2026-07-01T00:00:00Z");
  // Cas parfait : tout coche → 100, hot
  const hot = prospectScore({
    has_website: false, last_post_at: "2026-06-20T00:00:00Z", followers: 800,
    email: "a@b.fr", phone: null, is_business: true, bio: "Devis gratuit, dispo en MP",
  }, now);
  assert.deepEqual(hot, { score: 100, tier: "hot" });
  // Sans site + actif → 50, warm
  const warm = prospectScore({ has_website: false, last_post_at: "2026-06-20T00:00:00Z", followers: 50_000 }, now);
  assert.deepEqual(warm, { score: 50, tier: "warm" });
  // A un site, inactif, rien → 0, cold
  const cold = prospectScore({ has_website: true, last_post_at: null, followers: null }, now);
  assert.deepEqual(cold, { score: 0, tier: "cold" });
});

test("instagramDmSequence: trame complète, aucune ressource en DM, questionnaire en M9", () => {
  const demo = "https://x.fr/di/abc";
  const steps = instagramDmSequence(
    { metier: "menuisier", ville: "Angers", firstName: "Karim" },
    demo,
  );
  assert.equal(steps.length, 12); // M1-M9 + R1-R3
  assert.deepEqual(steps.slice(0, 3).map((s) => s.step), ["M1", "M2", "M3"]);
  // Règle de la méthode : AUCUNE ressource en DM — le questionnaire de M9 est le seul lien.
  for (const s of steps.filter((x) => x.step !== "M9")) {
    assert.ok(!/https?:\/\//.test(s.text), `${s.step} ne doit contenir aucun lien`);
  }
  // L'aperçu démo ne part jamais en DM, même quand on le fournit.
  assert.ok(!steps.some((s) => s.text.includes(demo)));
  assert.ok(!steps.find((s) => s.step === "M8")!.text.includes("aperçu"));
  assert.ok(steps.find((s) => s.step === "M9")!.text.includes(QUESTIONNAIRE_URL));
  // Personnalisation : prénom + métier naturel dans l'accroche, avatar artisan dans la présentation.
  assert.ok(steps[0].text.startsWith("Hello Karim"));
  assert.ok(steps[0].text.includes("J'ai vu que vous étiez menuisier"));
  assert.ok(steps.find((s) => s.step === "M3")!.text.includes("artisans du bâtiment"));
  // Douleur adaptée artisan (devis).
  assert.ok(steps.find((s) => s.step === "M7")!.text.includes("devis"));
});

test("instagramDmSequence: sans prénom ni démo, variante plateforme de résa", () => {
  const steps = instagramDmSequence(
    { metier: "coiffeur", ville: "", bookingPlatform: "Planity" },
    "",
  );
  assert.ok(steps[0].text.startsWith("Hello !"));
  assert.ok(!steps.find((s) => s.step === "M8")!.text.includes("http")); // la proposition d'appel ne porte aucun lien
  assert.ok(steps.find((s) => s.step === "M7")!.text.includes("Planity"));
  assert.ok(steps.find((s) => s.step === "M7")!.text.includes("RDV")); // vocabulaire salon
});

test("instagramDmSequence: accroche naturelle — profession IA prioritaire, fallback générique", () => {
  // Profession IA fournie → elle prime sur le métier regex.
  const ia = instagramDmSequence(
    { metier: "estheticienne", ville: "", professionIa: "Prothésiste ongulaire" },
    "",
  );
  assert.ok(ia[0].text.includes("J'ai vu que vous étiez prothésiste ongulaire"));
  // Plus jamais de « tes prestations beauté ».
  assert.ok(!ia[0].text.toLowerCase().includes("prestation"));
  // Métier inconnu, pas d'IA → accroche générique naturelle.
  const generic = instagramDmSequence({ metier: "", ville: "" }, "");
  assert.ok(generic[0].text.includes("toujours en activité"));
  // Établissements → formulation au lieu, jamais « vous étiez coiffeur(se) ».
  const resto = instagramDmSequence({ metier: "restaurant", ville: "" }, "");
  assert.ok(resto[0].text.includes("teniez un restaurant"));
  const salon = instagramDmSequence({ metier: "coiffeur", ville: "" }, "");
  assert.ok(salon[0].text.includes("teniez un salon de coiffure"));
  assert.ok(!salon[0].text.includes("(se)"));
  // La profession IA reste prioritaire sur la formulation au lieu.
  const barbier = instagramDmSequence({ metier: "coiffeur", ville: "", professionIa: "Barbier" }, "");
  assert.ok(barbier[0].text.includes("vous étiez barbier"));
});

test("detectMetier: métiers artisans détectés (catégorie ou bio)", () => {
  assert.equal(detectMetier("Menuiserie", ""), "menuisier");
  assert.equal(detectMetier(null, "Paysagiste — aménagement extérieur & élagage"), "paysagiste");
  assert.equal(detectMetier(null, "Pose carrelage et faïence"), "carreleur");
  assert.equal(detectMetier(null, "Couvreur zingueur, rénovation toiture"), "couvreur");
  assert.equal(detectMetier(null, "Électricien à Bordeaux, domotique"), "electricien");
  assert.equal(detectMetier(null, "Plombier chauffagiste"), "plombier"); // 1re règle qui matche
  assert.equal(detectMetier(null, "Maçonnerie générale"), "macon");
  assert.equal(detectMetier(null, "juste un compte perso"), "");
});

test("detectMetier: les artisans priment — plus de faux positifs esthéticienne", () => {
  // « la beauté de vos jardins » matchait l'esthétique avant le fix.
  assert.equal(detectMetier(null, "Paysagiste passionné — la beauté de vos jardins, spa de nage & terrasses"), "paysagiste");
  assert.equal(detectMetier(null, "Création de jardins et espaces verts pour embellir vos extérieurs"), "paysagiste");
  // « bien-être » seul ne suffit plus : formule marketing employée par tout commerce.
  // Cas réel (artisanfrancefenetre, 16/07) — un poseur de fenêtres classé esthéticienne.
  assert.equal(detectMetier(null, "Notre priorité : votre bien-être et votre satisfaction !"), "");
  assert.equal(detectMetier(null, "Votre bien-être avant tout"), "");
  // Les vraies esthéticiennes restent détectées.
  assert.equal(detectMetier("Institut de beauté", ""), "estheticienne");
  assert.equal(detectMetier(null, "Esthéticienne diplômée — épilation, soins visage, cils"), "estheticienne");
  assert.equal(detectMetier(null, "Prothésiste ongulaire, nail art"), "estheticienne");
  assert.equal(detectMetier(null, "Institut bien-être : massages et soins du corps"), "estheticienne");
});

test("firstNameOf: prénom seulement si fiable — sinon null (cas réels du 17/07)", () => {
  // Vrais prénoms : normalisés en capitale initiale.
  assert.equal(firstNameOf("Karim Menuiserie"), "Karim");
  assert.equal(firstNameOf("Samuel Berson Bsm"), "Samuel");
  assert.equal(firstNameOf("stéphane"), "Stéphane");
  // Enseignes : le 1er mot n'est pas un prénom → null (« Hello ! » seul).
  assert.equal(firstNameOf("Bois et jardins"), null); // « Hello Bois ! »
  assert.equal(firstNameOf("Atelier"), null); // « Hello Atelier ! »
  assert.equal(firstNameOf("Les Tables Vatel"), null); // « Hello Les ! »
  assert.equal(firstNameOf("Couvreur Pessac"), null); // métier, pas prénom
  assert.equal(firstNameOf("Hôtel Restaurant LA BÂTISSE"), null);
  assert.equal(firstNameOf("GARDE IMPERIAL BARBERSHOP"), null); // capitales = marque
  assert.equal(firstNameOf("LE B11"), null); // chiffre
  assert.equal(firstNameOf("CP Rénovation"), null); // sigle trop court
  assert.equal(firstNameOf("Sud Déco 34 | Décoratrice d'intérieur"), null); // séparateur
  assert.equal(firstNameOf("ADELINE MAISON & JARDIN"), null); // « & » = enseigne
  assert.equal(firstNameOf("Marié Stéphane | Couvreur Bordeaux"), null); // séparateur → prudence
  assert.equal(firstNameOf("Artisan France Fenetre"), null); // « Hello Artisan ! »
  assert.equal(firstNameOf(""), null);
  assert.equal(firstNameOf(null), null);
});

test("instagramDmSequence: vouvoiement systématique, aucun tutoiement résiduel", () => {
  const demo = "https://x.fr/di/abc";
  const steps = instagramDmSequence({ metier: "paysagiste", ville: "Angers", firstName: "Julie" }, demo);
  assert.equal(steps.length, 12);
  // Vouvoiement partout (frontières Unicode : « êtes » ≠ « tes »).
  const tutoie = /(?:^|[^\p{L}])(tu|toi|ton|tes)(?:[^\p{L}]|$)/iu;
  for (const s of steps) {
    assert.ok(!tutoie.test(s.text), `${s.step} ne doit pas tutoyer : ${s.text}`);
  }
  assert.ok(steps[0].text.includes("vous étiez paysagiste"));
  // M2 pivote sur ce qu'on a observé, sans encore rien proposer.
  assert.match(steps.find((s) => s.step === "M2")!.text, /interpell|remarqu|vu/i);
  // M4 demande la permission avant de partager — c'est l'étape de consentement.
  assert.match(steps.find((s) => s.step === "M4")!.text, /\?$/);
  // Douleur adaptée artisan (devis) même en vouvoiement.
  assert.ok(steps.find((s) => s.step === "M7")!.text.includes("devis"));
});

test("instagramDmSequence: messages COURTS — un DM long se lit comme un texte généré", () => {
  const steps = instagramDmSequence({ metier: "coiffeur", ville: "Nantes", firstName: "Léa" }, "https://x.fr/di/abc");
  for (const s of steps) {
    // M9 porte l'URL du questionnaire, seul lien de la trame : on l'exclut du calcul.
    const body = s.text.replace(/https?:\/\/\S+/g, "");
    assert.ok(
      body.length <= 220,
      `${s.step} fait ${body.length} caractères — au-delà de 220 on quitte le registre du DM (${s.text})`,
    );
  }
});

test("instagramDmSequenceSite: mêmes règles de tenue que la trame standard", () => {
  const demo = "https://x.fr/di/abc";
  const steps = instagramDmSequenceSite({ metier: "estheticienne", ville: "Angers", firstName: "Julie" }, demo);
  assert.deepEqual(steps.map((s) => s.step), ["S1", "S2", "S3", "S4", "S5", "R1", "R2", "R3"]);

  const tutoie = /(?:^|[^\p{L}])(tu|toi|ton|tes)(?:[^\p{L}]|$)/iu;
  for (const s of steps) {
    assert.ok(!tutoie.test(s.text), `${s.step} ne doit pas tutoyer : ${s.text}`);
    // Les URL sortent du calcul : elles portent le domaine de l'agence sans
    // être une signature, et leur longueur ne se lit pas comme du texte.
    const body = s.text.replace(/https?:\/\/\S+/g, "");
    assert.ok(body.length <= 260, `${s.step} fait ${body.length} caractères — on quitte le registre du DM`);
    // Aucun prix, aucune signature : les deux trames tiennent la même ligne.
    assert.ok(!/\d+\s*(€|euros)/i.test(body), `${s.step} ne doit annoncer aucun prix`);
    assert.ok(!/NMF|Nicolas Maillard/i.test(body), `${s.step} ne doit pas signer`);
  }

  // Un seul lien avant le questionnaire, et c'est l'aperçu — pas une ressource.
  const liens = steps.filter((s) => /https?:\/\//.test(s.text)).map((s) => s.step);
  assert.deepEqual(liens, ["S3", "S5"]);
  assert.ok(steps.find((s) => s.step === "S3")!.text.includes(demo));

  // La question s'adresse au client du prospect, pas au prospect.
  assert.match(steps.find((s) => s.step === "S2")!.text, /cherche votre nom sur Google/);
  assert.match(steps.find((s) => s.step === "S2")!.text, /« esthéticienne Angers »/);
});

test("competitorHook: appels pour artisans, réservations pour métiers à RDV", () => {
  const base = { ville: "Bordeaux", selfRank: 4, adsCount: 3 };
  // Artisan téléphone-first → « ces appels ».
  assert.ok(competitorHook({ ...base, metier: "plombier" }).includes("capter ces appels"));
  // Beauté / RDV → « ces réservations », y compris via texte libre avec accents.
  assert.ok(competitorHook({ ...base, metier: "esthéticienne" }).includes("capter ces réservations"));
  assert.ok(competitorHook({ ...base, metier: "institut de beauté" }).includes("capter ces réservations"));
  assert.ok(competitorHook({ ...base, metier: "coiffeur" }).includes("capter ces réservations"));
  // Structure : classement + vouvoiement systématique, prénom optionnel.
  const avecPrenom = competitorHook({ ...base, metier: "esthéticienne", firstName: "Julie" });
  assert.ok(avecPrenom.includes("Hello Julie") && avecPrenom.includes("vous êtes #4"));
  const sansPrenom = competitorHook({ ...base, metier: "esthéticienne" });
  assert.ok(sansPrenom.startsWith("Hello !") && sansPrenom.includes("vous êtes #4"));
  // Non classé → formulation dédiée, toujours en vouvoiement.
  const absent = competitorHook({ ...base, metier: "plombier", selfRank: null });
  assert.ok(absent.includes("vous n'apparaissez pas dans les résultats"));
  // Règle de la trame : observation + curiosité, jamais de pitch de l'offre.
  // Aucun tutoiement résiduel.
  const tutoie = /(?:^|[^\p{L}])(tu|toi|ton|tes)(?:[^\p{L}]|$)/iu;
  for (const msg of [avecPrenom, sansPrenom, absent]) {
    assert.ok(!/profiter|proposer|offre|accompagn|campagne/i.test(msg), `pas de pitch : ${msg}`);
    assert.ok(!tutoie.test(msg), `pas de tutoiement : ${msg}`);
    assert.ok(msg.endsWith("Vous l'aviez remarqué ?"));
  }
});

test("isHorsCible: ecarte hors zone francophone, fournisseurs B2B et blogs perso", () => {
  // Cas reels de la file du 20/07/2026.
  assert.equal(isHorsCible({ bio: "Lashista certificada 6 años Exp", full_name: "LASHES & INK" }), true);
  assert.equal(isHorsCible({ bio: "Termine ab 16j. > AGB's lesen", full_name: "nastys" }), true);
  assert.equal(isHorsCible({ bio: "Meseria Tatuator", full_name: "rada" }), true);
  assert.equal(isHorsCible({ bio: "Jalan Letkol Iskandar Telp/WA", full_name: "pempek" }), true);
  assert.equal(isHorsCible({ bio: "Hair Extensions 📍 Winter Garden & Winter Park, FL", full_name: "x" }), true);
  assert.equal(isHorsCible({ bio: "🍃 20 jardineries partout au Québec", full_name: "Botanix" }), true);
  assert.equal(isHorsCible({ bio: "Vente des machines pour l'usinage du bois", full_name: "hasky" }), true);
  assert.equal(isHorsCible({ bio: "Le logiciel des menuisiers & ébénistes", full_name: "sizelio" }), true);
  assert.equal(isHorsCible({ bio: "Déco / Lifestyle", category: "Personal blog", full_name: "clara" }), true);
  // Vrais prospects : conserves.
  assert.equal(isHorsCible({ bio: "Artisan Menuisier à Bordeaux, agencement", full_name: "Woodpeck" }), false);
  assert.equal(isHorsCible({ bio: "Paysagiste depuis 1971 📍 Dinard (Bretagne)", full_name: "Emeraude" }), false);
  assert.equal(isHorsCible({ bio: "BAR À VINS - BRASSERIE - MONS", full_name: "Le Cosmo" }), false);
  // Bio vide : on laisse passer (accroche generique).
  assert.equal(isHorsCible({ bio: "", full_name: "" }), false);
});
