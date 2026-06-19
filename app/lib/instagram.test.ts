import { test } from "node:test";
import assert from "node:assert/strict";
import { extractEmails, extractPhonesFr, pickContact, hasRealWebsite } from "./instagram";

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
