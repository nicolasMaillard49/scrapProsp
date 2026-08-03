import { test } from "node:test";
import assert from "node:assert/strict";
import { skillForWriting, skillForProofreading, MAX_SKILL_EXTRA } from "./igSkill";

test("skill (écriture) : porte l'objectif, la séquence, le style et les objections", () => {
  const s = skillForWriting();
  assert.match(s, /appel de 15-20 minutes/i);
  assert.match(s, /jamais de vendre en DM/i);
  assert.match(s, /M8 appel proposé/);
  assert.match(s, /une seule question par message/i);
  assert.match(s, /J'ai déjà un site/i);
});

test("skill (écriture) : les interdits durs y sont écrits noir sur blanc", () => {
  const s = skillForWriting();
  assert.match(s, /Aucune signature/i);
  assert.match(s, /Aucune coordonnée/i);
  assert.match(s, /Aucun lien avant l'étape M9/i);
  assert.match(s, /Aucun prix/i);
});

test("skill (correction) : garde le vocabulaire métier, pas la séquence", () => {
  const s = skillForProofreading();
  assert.match(s, /prothésiste ongulaire/);
  assert.match(s, /slt, tjr/);
  // Corriger n'a pas besoin de connaître la trame : prompt plus court, moins
  // de risque que le modèle se mette à « améliorer » le message.
  assert.doesNotMatch(s, /M8 appel proposé/);
});

test("skill : IG_SKILL_EXTRA s'ajoute aux deux blocs, et reste borné", () => {
  const before = process.env.IG_SKILL_EXTRA;
  try {
    process.env.IG_SKILL_EXTRA = "Ne jamais parler du concurrent XYZ.";
    assert.match(skillForWriting(), /concurrent XYZ/);
    assert.match(skillForProofreading(), /concurrent XYZ/);

    process.env.IG_SKILL_EXTRA = "x".repeat(MAX_SKILL_EXTRA + 500);
    const s = skillForWriting();
    assert.ok(!s.includes("x".repeat(MAX_SKILL_EXTRA + 1)), "consignes tronquées au plafond");

    // Vide ou absent : aucune section parasite.
    process.env.IG_SKILL_EXTRA = "   ";
    assert.doesNotMatch(skillForWriting(), /Consignes supplémentaires/);
  } finally {
    if (before === undefined) delete process.env.IG_SKILL_EXTRA;
    else process.env.IG_SKILL_EXTRA = before;
  }
});
