import { test } from "node:test";
import assert from "node:assert/strict";
import { isExtRequestAllowed } from "./extAuth";

test("extAuth: token exact sur /api/instagram/ → autorisé", () => {
  assert.equal(isExtRequestAllowed("/api/instagram/trame", "s3cret", "s3cret"), true);
  assert.equal(isExtRequestAllowed("/api/instagram/dm", "s3cret", "s3cret"), true);
  assert.equal(isExtRequestAllowed("/api/instagram/reply-ai", "s3cret", "s3cret"), true);
  assert.equal(isExtRequestAllowed("/api/instagram/proofread", "s3cret", "s3cret"), true);
  assert.equal(isExtRequestAllowed("/api/instagram/queue", "s3cret", "s3cret"), true);
});

test("extAuth: EXT_TOKEN absent ou vide = branche MORTE, jamais un laissez-passer", () => {
  assert.equal(isExtRequestAllowed("/api/instagram/trame", "", ""), false);
  assert.equal(isExtRequestAllowed("/api/instagram/trame", "x", undefined), false);
  // Même un en-tête vide face à un secret vide ne passe pas.
  assert.equal(isExtRequestAllowed("/api/instagram/trame", null, ""), false);
});

test("extAuth: mauvais token ou en-tête manquant → refusé", () => {
  assert.equal(isExtRequestAllowed("/api/instagram/trame", "faux", "s3cret"), false);
  assert.equal(isExtRequestAllowed("/api/instagram/trame", null, "s3cret"), false);
});

test("extAuth: portée bornée à /api/instagram/ — rien d'autre", () => {
  assert.equal(isExtRequestAllowed("/api/sms", "s3cret", "s3cret"), false);
  assert.equal(isExtRequestAllowed("/api/eligibilite/create", "s3cret", "s3cret"), false);
  assert.equal(isExtRequestAllowed("/instagram", "s3cret", "s3cret"), false);
});

test("extAuth: allowlist STRICTE — même sous /api/instagram/, seules /trame et /dm passent", () => {
  assert.equal(isExtRequestAllowed("/api/instagram/export", "s3cret", "s3cret"), false);
  assert.equal(isExtRequestAllowed("/api/instagram/discover", "s3cret", "s3cret"), false);
  assert.equal(isExtRequestAllowed("/api/instagram/trame/x", "s3cret", "s3cret"), false);
});
