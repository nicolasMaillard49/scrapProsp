import { test } from "node:test";
import assert from "node:assert/strict";
import { enums } from "google-ads-api";
import { buildKeywordRefreshOps } from "./keywordRefresh";
import type { Keyword } from "./copy";

const AG = "customers/123/adGroups/456";

test("buildKeywordRefreshOps: supprime les anciens criteria et crée les nouveaux", () => {
  const existing = ["customers/123/adGroupCriteria/456~111", "customers/123/adGroupCriteria/456~222"];
  const news: Keyword[] = [
    { text: "couvreur", match: "PHRASE" },
    { text: "couvreur", match: "EXACT" },
  ];
  const ops = buildKeywordRefreshOps(AG, existing, news);

  const removes = ops.filter((o) => o.operation === "remove");
  const creates = ops.filter((o) => o.operation === "create");
  assert.equal(removes.length, 2);
  assert.equal(creates.length, 2);
  assert.ok(removes.every((o) => o.entity === "ad_group_criterion"));
  assert.deepEqual(removes.map((o) => o.resource_name).sort(), [...existing].sort());
});

test("buildKeywordRefreshOps: les créations ciblent le bon ad group avec text + match_type", () => {
  const ops = buildKeywordRefreshOps(AG, [], [{ text: "devis couvreur", match: "PHRASE" }]);
  const create = ops.find((o) => o.operation === "create");
  assert.ok(create);
  assert.equal(create.resource.ad_group, AG);
  assert.equal(create.resource.keyword.text, "devis couvreur");
  assert.equal(create.resource.keyword.match_type, enums.KeywordMatchType.PHRASE);
});

test("buildKeywordRefreshOps: sans nouveaux mots-clés → uniquement des suppressions", () => {
  const ops = buildKeywordRefreshOps(AG, ["c1"], []);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].operation, "remove");
});

test("buildKeywordRefreshOps: rien à faire → tableau vide", () => {
  assert.deepEqual(buildKeywordRefreshOps(AG, [], []), []);
});

test("buildKeywordRefreshOps: ordre = suppressions AVANT créations (évite collision de doublons)", () => {
  const ops = buildKeywordRefreshOps(AG, ["c1"], [{ text: "couvreur", match: "EXACT" }]);
  assert.equal(ops[0].operation, "remove");
  assert.equal(ops[1].operation, "create");
});
