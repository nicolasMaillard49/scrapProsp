import { test } from "node:test";
import assert from "node:assert/strict";
import { chunk, buildQualifyPrompt, parseQualifyResponse, QUALIFY_BATCH_SIZE, estModeleInconnu } from "./igQualify";

test("chunk: découpe en lots de la taille demandée", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 10), []);
  assert.ok(QUALIFY_BATCH_SIZE >= 30 && QUALIFY_BATCH_SIZE <= 50); // règle 30-50
});

test("buildQualifyPrompt: n'inclut QUE nom/pseudo/abonnés/bio, avatar + fourchette", () => {
  const prompt = buildQualifyPrompt(
    [
      { username: "menuisier_du_49", full_name: "Atelier Bois", followers: 850, bio: "Menuisier sur mesure — devis gratuit" },
      { username: "x", full_name: null, followers: null, bio: null },
    ],
    { profession: "artisan du bâtiment", minFollowers: 100, maxFollowers: 2500, extra: "exclure les fournisseurs" },
  );
  assert.ok(prompt.includes("menuisier_du_49"));
  assert.ok(prompt.includes("abonnés: 850"));
  assert.ok(prompt.includes("entre 100 et 2500"));
  assert.ok(prompt.includes("exclure les fournisseurs"));
  assert.ok(prompt.includes("artisan du bâtiment"));
  // champs interdits par la règle : jamais de lien
  assert.ok(!/https?:\/\//.test(prompt));
  // profil sans infos → placeholders
  assert.ok(prompt.includes("pseudo: x | nom: — | abonnés: ? | bio: —"));
});

test("parseQualifyResponse: JSON propre → résultats typés", () => {
  const out = parseQualifyResponse(
    '[{"username":"a","verdict":"qualified","profession":"menuisier","reason":"bio pro FR"},{"username":"b","verdict":"rejected","profession":null,"reason":"marque"}]',
    ["a", "b"],
  );
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { username: "a", verdict: "qualified", profession: "menuisier", reason: "bio pro FR" });
  assert.equal(out[1].verdict, "rejected");
});

test("parseQualifyResponse: tolère le texte autour + @ + verdict inconnu → rejected", () => {
  const out = parseQualifyResponse(
    'Voici le tri :\n[{"username":"@a","verdict":"QUALIFIED"},{"username":"b","verdict":"peut-être"}]\nVoilà !',
    ["a", "b"],
  );
  assert.equal(out[0].verdict, "qualified");
  assert.equal(out[1].verdict, "rejected"); // verdict non reconnu → prudence
});

test("parseQualifyResponse: usernames inattendus ignorés, réponse cassée → vide", () => {
  assert.deepEqual(parseQualifyResponse('[{"username":"intrus","verdict":"qualified"}]', ["a"]), []);
  assert.deepEqual(parseQualifyResponse("pas du json", ["a"]), []);
  assert.deepEqual(parseQualifyResponse("[{cassé", ["a"]), []);
});

// Le 404 « model: claude-haiku-4-5 » du 02/08 : c'est CE cas qui doit déclencher
// le repli automatique sur l'ID daté, sinon la panne revient dès que la variable
// d'env Vercel reprend l'alias court.
test("estModeleInconnu: un 404 / not_found_error déclenche le repli", () => {
  assert.equal(estModeleInconnu({ status: 404 }), true);
  assert.equal(estModeleInconnu(new Error('404 {"type":"not_found_error","message":"model: claude-haiku-4-5"}')), true);
});

test("estModeleInconnu: les autres pannes NE sont pas des modèles inconnus", () => {
  // Se replier sur un autre modèle ne réparerait rien et masquerait la vraie cause.
  assert.equal(estModeleInconnu({ status: 429 }), false);
  assert.equal(estModeleInconnu(new Error("overloaded_error")), false);
  assert.equal(estModeleInconnu(new Error("credit balance is too low")), false);
  assert.equal(estModeleInconnu(new Error("fetch failed")), false);
});
