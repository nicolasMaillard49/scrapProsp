// Le point de rupture silencieux de la chaîne de secours : la traduction du
// shape RapidAPI vers celui d'Apify. Une clé mal mappée ne casse rien
// visiblement — elle vide juste le score et les contacts des prospects.
// Payloads réels tronqués (scan du 31/07/2026).

import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, mapLooter, mapStable } from "./rapidapi";
import { isProspect, pickContact, extractLastPostAt } from "../instagram";

test("mapLooter: profil GraphQL → shape Apify complet", () => {
  const p = mapLooter({
    status: true,
    username: "nmfagence",
    full_name: "NMF Agence · Sites web 48h",
    biography: "Sites web pour artisans — contact@nmf-agence.com",
    external_url: "https://bienvenue.nmf-agence.com/",
    bio_links: [{ url: "https://nmf-agence.com" }, { url: "" }],
    category_name: "Entrepreneur",
    business_email: "hello@nmf-agence.com",
    business_phone_number: "0102030405",
    is_professional_account: true,
    is_verified: false,
    is_private: false,
    profile_pic_url_hd: "https://cdn/hd.jpg",
    profile_pic_url: "https://cdn/low.jpg",
    id: "33524990617",
    edge_followed_by: { count: 105 },
    edge_follow: { count: 48 },
    edge_owner_to_timeline_media: { count: 20, edges: [{ node: { taken_at_timestamp: 1776858461 } }] },
  })!;

  assert.equal(p.username, "nmfagence");
  assert.equal(p.followersCount, 105);
  assert.equal(p.followsCount, 48);
  assert.equal(p.postsCount, 20);
  assert.equal(p.businessCategoryName, "Entrepreneur");
  assert.equal(p.isBusinessAccount, true);
  assert.equal(p.igUserId, "33524990617");
  // hd prioritaire, et les bio_links vides sont écartés
  assert.equal(p.profilePicUrl, "https://cdn/hd.jpg");
  assert.deepEqual(p.externalUrls, [{ url: "https://nmf-agence.com" }]);
  // Les consommateurs en aval doivent fonctionner à l'identique
  assert.equal(pickContact(p).email, "hello@nmf-agence.com");
  assert.equal(pickContact(p).phone, "0102030405");
  assert.equal(isProspect(p), false); // a un vrai site
  assert.equal(extractLastPostAt(p), "2026-04-22T11:47:41.000Z");
});

test("mapLooter: timestamps Unix → ISO, sinon last_post_at reste muet", () => {
  const p = mapLooter({
    username: "a.hair76",
    edge_owner_to_timeline_media: { count: 0, edges: [] },
  })!;
  assert.deepEqual(p.latestPosts, []);
  assert.equal(extractLastPostAt(p), null);
  // Un compte sans lien est un prospect : c'est le cœur du pitch NMF.
  assert.equal(isProspect(p), true);
});

test("mapLooter: pas de username → rien (compte supprimé/privé)", () => {
  assert.equal(mapLooter({ status: true }), null);
  assert.equal(mapLooter({ username: "  " }), null);
});

test("mapStable: schéma privé Instagram → shape Apify", () => {
  const p = mapStable({
    username: "nmfagence",
    full_name: "NMF Agence",
    biography: "Sites web 48h",
    external_url: "https://bienvenue.nmf-agence.com/",
    category: "Entrepreneur",
    follower_count: 105,
    following_count: 48,
    media_count: 20,
    is_business: false,
    is_verified: false,
    is_private: false,
    hd_profile_pic_url_info: { url: "https://cdn/hd.jpg" },
    profile_pic_url: "https://cdn/low.jpg",
    pk: "33524990617",
    email_from_biography: ["contact@nmf-agence.com"],
    phone_from_biography: ["0102030405"],
  })!;

  assert.equal(p.followersCount, 105);
  assert.equal(p.followsCount, 48);
  assert.equal(p.postsCount, 20);
  assert.equal(p.igUserId, "33524990617");
  assert.equal(p.profilePicUrl, "https://cdn/hd.jpg");
  assert.equal(pickContact(p).email, "contact@nmf-agence.com");
  assert.equal(pickContact(p).phone, "0102030405");
  // Cette API ne renvoie pas de posts : le double check d'activité est aveugle.
  assert.equal(extractLastPostAt(p), null);
});

test("classify: 429 quota mensuel ≠ 429 débit — le cooldown en dépend", () => {
  const quota = classify("looter", 429, '{"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC."}');
  assert.equal(quota.kind, "quota");

  const burst = classify("looter", 429, '{"message":"Too many requests"}');
  assert.equal(burst.kind, "rate_limit");
});

test("classify: 403 non abonné = config à corriger, pas quota", () => {
  assert.equal(classify("stable", 403, "You are not subscribed to this API.").kind, "auth");
  assert.equal(classify("stable", 403, "forbidden").kind, "quota");
  assert.equal(classify("stable", 401, "bad key").kind, "auth");
  assert.equal(classify("stable", 503, "upstream down").kind, "transient");
  assert.equal(classify("stable", 404, "nope").kind, "fatal");
});
