import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractEmails, extractPhonesFr, pickContact, hasRealWebsite,
  extractLastPostAt, isActiveSince, prospectScore, detectMetier,
  instagramDmSequence, QUESTIONNAIRE_URL,
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

test("instagramDmSequence: trame complète, aucun lien avant M8, questionnaire en M9", () => {
  const demo = "https://x.fr/di/abc";
  const steps = instagramDmSequence(
    { metier: "menuisier", ville: "Angers", firstName: "Karim" },
    demo,
  );
  assert.equal(steps.length, 12); // M1-M9 + R1-R3
  assert.deepEqual(steps.slice(0, 3).map((s) => s.step), ["M1", "M2", "M3"]);
  // Règle de la méthode : AUCUN lien avant la proposition d'appel (M8).
  for (const s of steps.filter((x) => ["M1", "M2", "M3", "M4", "M5", "M6", "M7"].includes(x.step))) {
    assert.ok(!/https?:\/\//.test(s.text), `${s.step} ne doit contenir aucun lien`);
  }
  // M8 porte l'aperçu démo, M9 le questionnaire.
  assert.ok(steps.find((s) => s.step === "M8")!.text.includes(demo));
  assert.ok(steps.find((s) => s.step === "M9")!.text.includes(QUESTIONNAIRE_URL));
  // Personnalisation : prénom + métier naturel dans l'accroche, avatar artisan dans la présentation.
  assert.ok(steps[0].text.startsWith("Hello Karim"));
  assert.ok(steps[0].text.includes("j'ai vu que tu étais menuisier".replace("j'ai", "J'ai")));
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
  assert.ok(!steps.find((s) => s.step === "M8")!.text.includes("http")); // pas de démo → pas de lien
  assert.ok(steps.find((s) => s.step === "M7")!.text.includes("Planity"));
  assert.ok(steps.find((s) => s.step === "M7")!.text.includes("RDV")); // vocabulaire salon
});

test("instagramDmSequence: accroche naturelle — profession IA prioritaire, fallback générique", () => {
  // Profession IA fournie → elle prime sur le métier regex.
  const ia = instagramDmSequence(
    { metier: "estheticienne", ville: "", professionIa: "Prothésiste ongulaire" },
    "",
  );
  assert.ok(ia[0].text.includes("j'ai vu que tu étais prothésiste ongulaire".replace("j'ai", "J'ai")));
  // Plus jamais de « tes prestations beauté ».
  assert.ok(!ia[0].text.toLowerCase().includes("prestation"));
  // Métier inconnu, pas d'IA → accroche générique naturelle.
  const generic = instagramDmSequence({ metier: "", ville: "" }, "");
  assert.ok(generic[0].text.includes("toujours en activité"));
  // Restaurant → formulation dédiée.
  const resto = instagramDmSequence({ metier: "restaurant", ville: "" }, "");
  assert.ok(resto[0].text.includes("tenais un restaurant"));
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
