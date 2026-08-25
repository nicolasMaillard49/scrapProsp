import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  parseLead,
  makeToken,
  leadNotification,
  googleAdsDateTime,
} from "./adsLeads";

test("normalizePhone accepte les formats qu'un visiteur tape vraiment", () => {
  for (const saisi of ["0615907873", "06 15 90 78 73", "06.15.90.78.73", "+33615907873", "33615907873"]) {
    assert.equal(normalizePhone(saisi), "+33615907873", saisi);
  }
  assert.equal(normalizePhone("01 80 81 38 40"), "+33180813840");
});

test("normalizePhone refuse ce qui n'est pas un numéro français", () => {
  for (const mauvais of ["", "0015907873", "061590787", "06159078731", "+4915907873", "bonjour"]) {
    assert.equal(normalizePhone(mauvais), null, mauvais);
  }
});

test("parseLead exige le nom, le téléphone et le message — rien d'autre", () => {
  const complet = { name: "Jean", phone: "0615907873", message: "Un dressing" };
  assert.equal(parseLead(complet, "totowood").ok, true);

  for (const champ of ["name", "phone", "message"] as const) {
    const amputé = { ...complet, [champ]: "" };
    const r = parseLead(amputé, "totowood");
    assert.equal(r.ok, false, champ);
    if (!r.ok) assert.equal(r.status, 422);
  }
});

test("parseLead ne refuse jamais un lead pour un gclid manquant", () => {
  // Un visiteur revenu en direct n'a pas de ticket. Sa demande vaut quand même
  // un rappel : on l'enregistre, elle ne sera simplement pas attribuable.
  const r = parseLead({ name: "Jean", phone: "0615907873", message: "Une cuisine" }, "totowood");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.row.gclid, null);
});

test("parseLead recopie les sept paramètres ValueTrack", () => {
  const r = parseLead(
    {
      name: "Jean",
      phone: "0615907873",
      message: "Un dressing",
      tracking: {
        gclid: "Cj0KCQ",
        ag: "123",
        kw: "dressing sur mesure",
        mt: "e",
        dev: "m",
        loc: "9040885",
        camp: "456",
        landing: "/dressing",
        referrer: "direct",
      },
    },
    "totowood",
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.row.gclid, "Cj0KCQ");
  assert.equal(r.row.kw, "dressing sur mesure");
  assert.equal(r.row.device, "m", "dev est stocké dans la colonne device");
  assert.equal(r.row.camp, "456");
  assert.equal(r.row.landing, "/dressing");
});

test("parseLead borne les champs libres au lieu de laisser passer un roman", () => {
  const r = parseLead(
    { name: "x".repeat(500), phone: "0615907873", message: "y".repeat(9000) },
    "totowood",
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.row.name.length, 120);
  assert.equal(r.row.message.length, 4000);
});

test("makeToken produit un jeton long, sans caractère ambigu", () => {
  const t = makeToken();
  assert.equal(t.length, 24);
  // Ni l/1 ni o/0 : l'artisan le lit parfois à voix haute au téléphone.
  assert.match(t, /^[abcdefghijkmnopqrstuvwxyz23456789]+$/);
  assert.notEqual(makeToken(), makeToken());
});

test("la notification signale l'absence de gclid, parce que c'est ça qui coûte", () => {
  const base = { name: "Jean", phone: "0615907873", message: "Un dressing" };
  const avec = parseLead({ ...base, tracking: { gclid: "abc" } }, "totowood");
  const sans = parseLead(base, "totowood");
  assert.equal(avec.ok && sans.ok, true);
  if (!avec.ok || !sans.ok) return;

  assert.ok(!leadNotification(avec.row, "Totowood", "https://x/q/t").includes("sans gclid"));
  assert.ok(leadNotification(sans.row, "Totowood", "https://x/q/t").includes("sans gclid"));
});

test("la notification échappe le HTML — Telegram parse en HTML", () => {
  const r = parseLead(
    { name: "<b>Jean</b>", phone: "0615907873", message: "3 m & <script>" },
    "totowood",
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const texte = leadNotification(r.row, "Totowood", "https://x/q/t");
  assert.ok(!texte.includes("<script>"));
  assert.ok(texte.includes("&lt;b&gt;Jean&lt;/b&gt;"));
  assert.ok(texte.includes("&amp;"));
});

test("googleAdsDateTime écrit le décalage explicite que Google exige", () => {
  // Un ISO 8601 nu est refusé à l'import : il faut « +02:00 », pas « Z ».
  const d = new Date("2026-09-01T19:14:03.000Z");
  assert.equal(googleAdsDateTime(d, 120), "2026-09-01 21:14:03+02:00");
  assert.equal(googleAdsDateTime(d, 60), "2026-09-01 20:14:03+01:00");
});
