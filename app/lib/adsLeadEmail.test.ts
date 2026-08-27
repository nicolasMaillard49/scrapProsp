import { test } from "node:test";
import assert from "node:assert/strict";
import { leadEmail, formatPhoneFr, formatDateFr } from "./adsLeadEmail";
import type { LeadRow } from "./adsLeads";

const ROW: LeadRow = {
  client_slug: "totowood",
  name: "Camille Perrot",
  phone: "+33615907873",
  email: "camille@example.fr",
  commune: "Annet-sur-Marne",
  message: "Un dressing sous pente.\nDeux mètres de large.",
  service: "Dressing",
  gclid: "Cj0K",
  ag: "dressing",
  kw: "dressing sur mesure",
  mt: "e",
  device: "m",
  loc: "9040990",
  camp: "totowood",
  landing: "/dressing",
  referrer: "https://www.google.com/",
  token: "kzr7pq3mf8xat2vhnc9wdjeb",
};

const QUALIFY = "https://prospects.nmf-agence.com/q/kzr7pq3mf8xat2vhnc9wdjeb";
const RECU = new Date("2026-08-27T14:32:00+02:00");

test("formatPhoneFr rend le numéro comme un Français le lit", () => {
  assert.equal(formatPhoneFr("+33615907873"), "06 15 90 78 73");
  assert.equal(formatPhoneFr("+33180813840"), "01 80 81 38 40");
});

test("formatPhoneFr rend l'entrée telle quelle si ce n'est pas un numéro FR", () => {
  for (const autre of ["+4915907873", "0615907873", ""]) {
    assert.equal(formatPhoneFr(autre), autre, autre);
  }
});

test("formatDateFr donne l'heure de Paris, pas celle du serveur", () => {
  const tz = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    assert.match(formatDateFr(RECU), /^Jeudi 27 août .*14:32$/);
  } finally {
    process.env.TZ = tz;
  }
});

test("l'e-mail met le numéro dans l'objet — l'aperçu suffit pour rappeler", () => {
  const { subject } = leadEmail(ROW, "Totowood", QUALIFY, RECU);
  assert.ok(subject.includes("Camille Perrot"), subject);
  assert.ok(subject.includes("Annet-sur-Marne"), subject);
  assert.ok(subject.includes("06 15 90 78 73"), subject);
});

test("les deux actions sont présentes, et le numéro reste en E.164 dans le lien", () => {
  const { html } = leadEmail(ROW, "Totowood", QUALIFY, RECU);
  // `tel:` doit porter le format international, sinon un appel depuis
  // l'étranger ou un carnet mal réglé échoue.
  assert.ok(html.includes('href="tel:+33615907873"'), "lien d'appel absent");
  assert.ok(html.includes("Rappeler le 06 15 90 78 73"), "libellé d'appel absent");
  assert.ok(html.includes(`href="${QUALIFY}"`), "lien de qualification absent");
});

test("le message garde ses retours à la ligne", () => {
  const { html } = leadEmail(ROW, "Totowood", QUALIFY, RECU);
  assert.ok(html.includes("Un dressing sous pente.<br>Deux mètres de large."));
});

test("un champ libre ne peut pas injecter de HTML", () => {
  const piege: LeadRow = {
    ...ROW,
    name: '<script>alert("xss")</script>',
    message: "Un <b>dressing</b> & une bibliothèque",
    commune: "<img src=x onerror=alert(1)>",
  };
  const { html } = leadEmail(piege, "Totowood", QUALIFY, RECU);
  assert.ok(!html.includes("<script>"), "balise script non échappée");
  assert.ok(!html.includes("<img src=x"), "balise img non échappée");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("Un &lt;b&gt;dressing&lt;/b&gt; &amp; une bibliothèque"));
});

test("le gclid et le mot-clé ne partent pas chez l'artisan", () => {
  const { html, text } = leadEmail(ROW, "Totowood", QUALIFY, RECU);
  for (const rendu of [html, text]) {
    assert.ok(!rendu.includes("Cj0K"), "gclid exposé");
    assert.ok(!rendu.includes("dressing sur mesure"), "mot-clé exposé");
  }
});

test("une demande sans e-mail ni commune ne laisse pas de trou", () => {
  const nu: LeadRow = { ...ROW, email: null, commune: null, service: null };
  const { html, subject, text } = leadEmail(nu, "Totowood", QUALIFY, RECU);
  assert.ok(!html.includes("mailto:"), "bloc e-mail rendu alors qu'il n'y a pas d'adresse");
  assert.ok(!html.includes("null"), "un null a fuité dans le rendu");
  assert.ok(!subject.includes("null"), subject);
  assert.ok(!text.includes("null"), text);
});

test("la version texte porte tout ce qui permet d'agir", () => {
  const { text } = leadEmail(ROW, "Totowood", QUALIFY, RECU);
  assert.ok(text.includes("Camille Perrot"));
  assert.ok(text.includes("06 15 90 78 73"));
  assert.ok(text.includes("Un dressing sous pente."));
  assert.ok(text.includes(QUALIFY));
  assert.ok(!text.includes("<"), "du HTML a fuité dans la version texte");
});

test("le rendu porte la DA des landing pages, pas celle de l'admin", () => {
  const { html } = leadEmail(ROW, "Totowood", QUALIFY, RECU);
  // Les tokens de totowood-lp/src/app/globals.css. Ce test existe pour qu'une
  // retouche du gabarit ne rapatrie pas la palette de l'outil interne : le
  // client voit la marque de l'artisan, jamais celle de l'agence.
  for (const jeton of ["#011627", "#57423a", "#efeae6", "#e4e1de"]) {
    assert.ok(html.includes(jeton), `token absent du rendu : ${jeton}`);
  }
  assert.ok(!html.includes("#7857ff"), "l'accent de l'admin a repris le dessus");
  assert.ok(html.includes("Plus Jakarta Sans"), "police de titre absente");
  assert.ok(html.includes("Manrope"), "police de corps absente");
});
