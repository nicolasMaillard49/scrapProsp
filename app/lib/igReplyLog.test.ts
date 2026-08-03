import { test } from "node:test";
import assert from "node:assert/strict";
import { asUuidOrNull } from "./igReplyLog";

const UUID = "3f8a1c2e-9b4d-4e6f-8a1b-2c3d4e5f6a7b";

test("asUuidOrNull: une chaîne VIDE vaut « pas de compte », pas un uuid cassé", () => {
  // Le cas réel : activeAccount vaut "" tant qu'aucun compte n'est choisi.
  // Envoyé tel quel, Postgres rendait « invalid input syntax for type uuid ».
  assert.deepEqual(asUuidOrNull(""), { value: null, malformed: false });
  assert.deepEqual(asUuidOrNull("   "), { value: null, malformed: false });
  assert.deepEqual(asUuidOrNull(undefined), { value: null, malformed: false });
  assert.deepEqual(asUuidOrNull(null), { value: null, malformed: false });
});

test("asUuidOrNull: uuid valide conservé, espaces autour tolérés", () => {
  assert.deepEqual(asUuidOrNull(UUID), { value: UUID, malformed: false });
  assert.deepEqual(asUuidOrNull(`  ${UUID}  `), { value: UUID, malformed: false });
  assert.deepEqual(asUuidOrNull(UUID.toUpperCase()), { value: UUID.toUpperCase(), malformed: false });
});

test("asUuidOrNull: valeur mal formée signalée — jamais transmise à la base", () => {
  // Signalé plutôt que silencieusement ignoré : un identifiant erroné est un
  // bug appelant, pas une absence de compte.
  assert.deepEqual(asUuidOrNull("nmfagence"), { value: null, malformed: true });
  assert.deepEqual(asUuidOrNull("123"), { value: null, malformed: true });
  assert.deepEqual(asUuidOrNull(`${UUID}x`), { value: null, malformed: true });
});
