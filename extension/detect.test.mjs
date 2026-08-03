import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import NMFDetect from "./detect.js";

const dom = (html, url = "https://www.instagram.com/") => new JSDOM(html, { url });

test("currentUsername: page profil → pseudo depuis l'URL (stratégie la plus stable)", () => {
  const d = dom("<body></body>", "https://www.instagram.com/laura_x/");
  assert.equal(NMFDetect.currentUsername(d.window.location, d.window.document), "laura_x");
  // Les routes réservées ne sont PAS des profils.
  for (const p of ["direct/inbox", "explore", "reels", "accounts/edit", "p/abc123"]) {
    const r = dom("<body></body>", `https://www.instagram.com/${p}/`);
    assert.equal(NMFDetect.currentUsername(r.window.location, r.window.document), null, p);
  }
});

test("currentUsername: conversation DM → pseudo depuis le lien de profil du header", () => {
  const d = dom(
    `<body><header>
       <a role="link" href="/laura_x/"><img alt="Photo de profil de laura_x" /></a>
       <div>Laura Dupont</div>
     </header></body>`,
    "https://www.instagram.com/direct/t/1234567890/",
  );
  assert.equal(NMFDetect.currentUsername(d.window.location, d.window.document), "laura_x");
});

test("currentUsername: conversation sans header reconnaissable → null, sans jeter", () => {
  const d = dom("<body><div>rien</div></body>", "https://www.instagram.com/direct/t/999/");
  assert.equal(NMFDetect.currentUsername(d.window.location, d.window.document), null);
});

test("composerNode: contenteditable avec aria-label Message → trouvé ; sinon null", () => {
  const ok = dom(`<body><div contenteditable="true" aria-label="Message" role="textbox"></div></body>`);
  assert.ok(NMFDetect.composerNode(ok.window.document));
  const ko = dom(`<body><div>pas de champ</div></body>`);
  assert.equal(NMFDetect.composerNode(ko.window.document), null);
});

test("loggedInAccount: lien de nav vers son propre profil (img alt « photo de profil ») → pseudo", () => {
  const d = dom(
    `<body><nav><a href="/nmf.agence/"><img alt="Photo de profil de nmf.agence" /></a></nav></body>`,
  );
  assert.equal(NMFDetect.loggedInAccount(d.window.document), "nmf.agence");
  const vide = dom("<body></body>");
  assert.equal(NMFDetect.loggedInAccount(vide.window.document), null);
});

test("loggedInAccount: dans un DM, l'avatar du header est celui du PROSPECT — jamais retenu", () => {
  // Nav réduite à des icônes (cas /direct/), header = avatar du prospect.
  const d = dom(
    `<body>
       <nav><a href="/direct/inbox/"><svg></svg></a></nav>
       <header><a href="/laura_x/"><img alt="Photo de profil de laura_x" /></a></header>
     </body>`,
    "https://www.instagram.com/direct/t/123/",
  );
  assert.equal(NMFDetect.loggedInAccount(d.window.document, { exclude: "laura_x" }), null);
  // Sans l'exclusion, on retomberait sur le prospect : c'est bien ce garde-fou
  // qui empêche de créditer les quotas du mauvais compte.
  assert.equal(NMFDetect.loggedInAccount(d.window.document), "laura_x");
});

test("loggedInAccount: JSON embarqué → compte connecté détecté même dans les DM", () => {
  const d = dom(
    `<body>
       <nav><a href="/direct/inbox/"><svg></svg></a></nav>
       <header><a href="/laura_x/"><img alt="Photo de profil de laura_x" /></a></header>
       <script type="application/json">{"config":{"viewer":{"id":"42","username":"nmfagence","is_pro":true}}}</script>
     </body>`,
    "https://www.instagram.com/direct/t/123/",
  );
  assert.equal(NMFDetect.loggedInAccount(d.window.document, { exclude: "laura_x" }), "nmfagence");
});

test("loggedInAccount: la nav prime sur le JSON, et rien de plausible → null", () => {
  const d = dom(
    `<body>
       <nav><a href="/nmf.agence/"><img alt="Photo de profil de nmf.agence" /></a></nav>
       <script type="application/json">{"viewer":{"username":"vieux_compte"}}</script>
     </body>`,
  );
  assert.equal(NMFDetect.loggedInAccount(d.window.document), "nmf.agence");
  assert.equal(NMFDetect.loggedInAccount(dom("<body></body>").window.document), null);
});

test("conversationThread: rend le fil ordonné avec l'auteur de chaque message", () => {
  const d = dom(`<body>
    <div role="row" aria-label="Vous avez envoyé : Hello ! Vous êtes toujours menuisier ?"><span>Hello ! Vous êtes toujours menuisier ?</span></div>
    <div role="row"><img alt="Photo de profil de laura_x" /><span>Oui toujours</span></div>
    <div role="row" aria-label="Vous avez envoyé : Parfait !"><span>Parfait !</span></div>
    <div role="row"><img alt="Photo de profil de laura_x" /><span>C'est quoi votre tarif ?</span></div>
  </body>`);
  const rows = NMFDetect.conversationThread(d.window.document, { username: "laura_x" });
  assert.deepEqual(
    rows.map((r) => r.from),
    ["moi", "lui", "moi", "lui"],
  );
  assert.equal(rows[3].text, "C'est quoi votre tarif ?");
  assert.equal(NMFDetect.lastIncomingText(d.window.document, { username: "laura_x" }), "C'est quoi votre tarif ?");
});

test("conversationThread: auteur indéterminé reste « ? » — on n'invente pas", () => {
  const d = dom(`<body>
    <div role="row"><span>message sans le moindre indice</span></div>
    <div role="row"><span>Vu</span></div>
  </body>`);
  const rows = NMFDetect.conversationThread(d.window.document);
  assert.equal(rows.length, 1, "les accusés de lecture ne sont pas des messages");
  assert.equal(rows[0].from, "?");
  assert.deepEqual(NMFDetect.conversationThread(null), []);
});

test("lastIncomingText: rend le dernier message REÇU, pas le dernier envoyé", () => {
  const d = dom(`<body>
    <div role="row" aria-label="Vous avez envoyé : Hello ! Vous êtes toujours menuisier ?"><span>Hello ! Vous êtes toujours menuisier ?</span></div>
    <div role="row"><span>Oui toujours, c'est quoi votre tarif ?</span></div>
    <div role="row" aria-label="Vous avez envoyé : ok"><span>ok</span></div>
  </body>`);
  assert.equal(NMFDetect.lastIncomingText(d.window.document), "Oui toujours, c'est quoi votre tarif ?");
});

test("lastIncomingText: ignore accusés de lecture et horodatages isolés", () => {
  const d = dom(`<body>
    <div role="row"><span>Ça m'intéresse</span></div>
    <div role="row"><span>Vu</span></div>
    <div role="row"><span>14:32</span></div>
  </body>`);
  assert.equal(NMFDetect.lastIncomingText(d.window.document), "Ça m'intéresse");
});

test("lastIncomingText: rien de plausible → null, jamais une exception", () => {
  assert.equal(NMFDetect.lastIncomingText(dom("<body><div>vide</div></body>").window.document), null);
  // Uniquement des messages sortants : rien à proposer.
  const sortants = dom(`<body><div role="row" aria-label="You sent: yo"><span>yo</span></div></body>`);
  assert.equal(NMFDetect.lastIncomingText(sortants.window.document), null);
  assert.equal(NMFDetect.lastIncomingText(null), null);
});

test("watchSend: déclenche quand le champ passe de rempli à vide, une seule fois", async () => {
  const d = dom(`<body><div contenteditable="true" aria-label="Message">brouillon</div></body>`);
  const node = NMFDetect.composerNode(d.window.document);
  let fired = 0;
  const unwatch = NMFDetect.watchSend(node, () => fired++, { intervalMs: 5, win: d.window });
  await new Promise((r) => setTimeout(r, 20)); // encore rempli → rien
  assert.equal(fired, 0);
  node.textContent = "";
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(fired, 1);
  node.textContent = "re-rempli"; node.textContent = "";
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(fired, 1, "one-shot : une détection par armement");
  unwatch();
});

test("watchSend: nœud retiré du DOM (recyclé par Instagram) → pas de détection d'envoi", async () => {
  const d = dom(`<body><div contenteditable="true" aria-label="Message">brouillon</div></body>`);
  const node = NMFDetect.composerNode(d.window.document);
  let fired = 0;
  const unwatch = NMFDetect.watchSend(node, () => fired++, { intervalMs: 5, win: d.window });
  node.remove();
  node.textContent = "";
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(fired, 0, "nœud non connecté ≠ envoi");
  unwatch();
});
