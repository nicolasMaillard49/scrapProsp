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

test("currentUsername: DM sans <header> → vote sur les liens de profil de la page", () => {
  // Cas réel : la liste de gauche n'expose que des liens /direct/t/…, tandis
  // que l'interlocuteur apparaît plusieurs fois (en-tête, carte, Voir profil).
  const d = dom(
    `<body>
       <nav><a href="/nmfagence/"><img alt="Photo de profil de nmfagence" /></a></nav>
       <aside>
         <a href="/direct/t/111/">Sun Nails</a>
         <a href="/direct/t/222/">Thomas Pecoud</a>
       </aside>
       <div>
         <a href="/thomas.pecoud_osteopathe/"><img alt="Thomas Pecoud's profile picture" /></a>
         <a href="/thomas.pecoud_osteopathe/">thomas.pecoud_osteopathe</a>
         <a href="/thomas.pecoud_osteopathe/">Voir profil</a>
       </div>
     </body>`,
    "https://www.instagram.com/direct/t/222/",
  );
  assert.equal(
    NMFDetect.currentUsername(d.window.location, d.window.document, { exclude: "nmfagence" }),
    "thomas.pecoud_osteopathe",
  );
});

test("currentUsername: le compte connecté n'est jamais pris pour le prospect", () => {
  // Sa propre photo de profil est partout dans l'interface : sans exclusion,
  // elle gagnerait le vote et Nicolas se prospecterait lui-même.
  const d = dom(
    `<body>
       <a href="/nmfagence/">a</a><a href="/nmfagence/">b</a><a href="/nmfagence/">c</a>
       <a href="/laura_x/">profil</a>
     </body>`,
    "https://www.instagram.com/direct/t/333/",
  );
  assert.equal(NMFDetect.currentUsername(d.window.location, d.window.document, { exclude: "nmfagence" }), "laura_x");
});

test("currentUsername: égalité entre candidats → null (aucune certitude, jamais de pari)", () => {
  const d = dom(
    `<body><a href="/laura_x/">1</a><a href="/marc_y/">2</a></body>`,
    "https://www.instagram.com/direct/t/444/",
  );
  assert.equal(NMFDetect.currentUsername(d.window.location, d.window.document), null);
  // Boîte de réception sans conversation ouverte : rien à détecter.
  const inbox = dom(
    `<body><a href="/direct/t/1/">c1</a><a href="/direct/t/2/">c2</a></body>`,
    "https://www.instagram.com/direct/inbox/",
  );
  assert.equal(NMFDetect.currentUsername(inbox.window.location, inbox.window.document), null);
});

test("loggedInAccount strict: n'utilise que nav et JSON, jamais un tiers du document", () => {
  const d = dom(
    `<body><header><a href="/laura_x/"><img alt="Photo de profil de laura_x" /></a></header></body>`,
    "https://www.instagram.com/direct/t/555/",
  );
  // Sans strict, le repli « tout le document » ramènerait le prospect.
  assert.equal(NMFDetect.loggedInAccount(d.window.document), "laura_x");
  assert.equal(NMFDetect.loggedInAccount(d.window.document, { strict: true }), null);
});

test("composerNode: contenteditable avec aria-label Message → trouvé ; sinon null", () => {
  const ok = dom(`<body><div contenteditable="true" aria-label="Message" role="textbox"></div></body>`);
  assert.ok(NMFDetect.composerNode(ok.window.document));
  const ko = dom(`<body><div>pas de champ</div></body>`);
  assert.equal(NMFDetect.composerNode(ko.window.document), null);
});

test("contactButton: Contacter prime avant Message, sans confondre le bouton Envoyer", () => {
  assert.equal(typeof NMFDetect.contactButton, "function");
  const d = dom(`<body>
    <button>Envoyer</button>
    <button id="message">Message</button>
    <div role="button" id="contact"><span>Contacter</span></div>
  </body>`, "https://www.instagram.com/laura_x/");
  assert.equal(NMFDetect.contactButton(d.window.document)?.id, "contact");

  const absent = dom(`<body><button>Suivre</button><button>Envoyer</button></body>`);
  assert.equal(NMFDetect.contactButton(absent.window.document), null);
});

test("prepareContact: attend Contacter rendu en retard puis le champ DM", async () => {
  assert.equal(typeof NMFDetect.prepareContact, "function");
  const d = dom(`<body><main id="profile"></main></body>`, "https://www.instagram.com/laura_x/");
  d.window.setTimeout(() => {
    const profile = d.window.document.getElementById("profile");
    profile.innerHTML = `<a href="#" id="contact"><span>Contacter</span></a>`;
    profile.querySelector("#contact").addEventListener("click", (event) => {
      event.preventDefault();
      d.window.setTimeout(() => {
        profile.innerHTML = `<div contenteditable="true" aria-label="Message" role="textbox"></div>`;
      }, 10);
    });
  }, 10);

  const result = await NMFDetect.prepareContact(d.window.document, { win: d.window, intervalMs: 5, timeoutMs: 200 });
  assert.deepEqual(result, { ok: true, clicked: "contacter" });
  assert.ok(NMFDetect.composerNode(d.window.document));
});

test("prepareContact: un clic manuel pendant l'attente mène quand même à l'insertion", async () => {
  assert.equal(typeof NMFDetect.prepareContact, "function");
  const d = dom(`<body><main id="profile"></main></body>`, "https://www.instagram.com/laura_x/");
  d.window.setTimeout(() => {
    d.window.document.getElementById("profile").innerHTML =
      `<div contenteditable="true" aria-label="Message" role="textbox"></div>`;
  }, 10);

  const result = await NMFDetect.prepareContact(d.window.document, { win: d.window, intervalMs: 5, timeoutMs: 200 });
  assert.deepEqual(result, { ok: true, clicked: null });
});

test("prepareContact: traverse Contacter puis Message si Instagram affiche deux sas", async () => {
  const d = dom(`<body><main id="profile"><button id="contact">Contacter</button></main></body>`, "https://www.instagram.com/laura_x/");
  const profile = d.window.document.getElementById("profile");
  profile.querySelector("#contact").addEventListener("click", () => {
    profile.insertAdjacentHTML("beforeend", `<button id="message"><span>Message</span></button>`);
    profile.querySelector("#message").addEventListener("click", () => {
      profile.innerHTML = `<div contenteditable="true" aria-label="Message" role="textbox"></div>`;
    });
  });

  const result = await NMFDetect.prepareContact(d.window.document, { win: d.window, intervalMs: 5, timeoutMs: 200 });
  assert.deepEqual(result, { ok: true, clicked: "contacter" });
  assert.ok(NMFDetect.composerNode(d.window.document));
});

test("profileUnavailable: reconnaît les pages supprimées Instagram en français et anglais", () => {
  assert.equal(typeof NMFDetect.profileUnavailable, "function");
  const fr = dom(`<body><main><h2>Cette page n’est malheureusement pas disponible.</h2>
    <p>Le lien que vous avez suivi est peut-être rompu, ou la page a été supprimée.</p></main></body>`);
  const en = dom(`<body><main><h2>Sorry, this page isn't available.</h2>
    <p>The link you followed may be broken, or the page may have been removed.</p></main></body>`);
  const profil = dom(`<body><main><h2>Laura</h2><button>Contacter</button></main></body>`);

  assert.equal(NMFDetect.profileUnavailable(fr.window.document), true);
  assert.equal(NMFDetect.profileUnavailable(en.window.document), true);
  assert.equal(NMFDetect.profileUnavailable(profil.window.document), false);
});

test("prepareContact: arrête immédiatement l'attente sur un profil indisponible", async () => {
  const d = dom(`<body><main><h2>Cette page n'est malheureusement pas disponible.</h2></main></body>`);
  const result = await NMFDetect.prepareContact(d.window.document, {
    win: { setTimeout: () => { throw new Error("aucune attente ne doit être planifiée"); } },
    intervalMs: 5,
    timeoutMs: 200,
  });

  assert.deepEqual(result, { ok: false, reason: "profile-unavailable", clicked: null });
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

test("loggedInAccount: titre du sélecteur de compte (DOM réel de /direct/)", () => {
  // Structure relevée sur la vraie messagerie : SPAN < H2 < DIV[role=button],
  // et l'avatar « Photo de profil de nmfagence » qui confirme le pseudo.
  const d = dom(
    `<body>
       <div role="button"><h2><span>nmfagence</span></h2></div>
       <img alt="Photo de profil de nmfagence" />
       <header><a href="/laura_x/"><img alt="Photo de profil de laura_x" /></a></header>
     </body>`,
    "https://www.instagram.com/direct/t/1/",
  );
  assert.equal(NMFDetect.loggedInAccount(d.window.document, { exclude: "laura_x" }), "nmfagence");
});

test("loggedInAccount: un titre sans avatar correspondant n'est pas retenu", () => {
  // Sans le second signal, le pseudo d'un tiers affiché en titre passerait
  // pour le compte connecté.
  const d = dom(`<body><h2><span>un_autre_compte</span></h2></body>`);
  assert.equal(NMFDetect.loggedInAccount(d.window.document, { strict: true }), null);
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

/**
 * Fil de conversation façon Instagram : des `span[dir="auto"]` dans un volet
 * défilant, l'auteur donné par l'alignement horizontal (mesuré sur une vraie
 * conversation : sortants à 84-90 % de la largeur, entrants à 7-12 %).
 * jsdom ne calcule aucune géométrie — les rectangles sont donc injectés.
 */
function threadDom(messages) {
  const d = dom(`<body><div id="scope">${messages
    .map((m) => `<span dir="auto">${m.text}</span>`)
    .join("")}</div></body>`);
  const scope = d.window.document.getElementById("scope");
  const W = 1000;
  const byText = new Map(messages.map((m) => [m.text, m]));
  const rectOf = (el) => {
    if (el === scope) return { left: 0, width: W };
    const m = byText.get((el.textContent || "").trim());
    // rel ≈ 0.87 pour un sortant, 0.10 pour un entrant, 0.50 si centré.
    const rel = m?.side === "moi" ? 0.87 : m?.side === "lui" ? 0.1 : 0.5;
    return { left: rel * W - 50, width: 100 };
  };
  return { doc: d.window.document, scope, rectOf };
}

/**
 * La page DM réelle, relevée le 04/08/2026 sur une vraie conversation
 * (viewport 2048) : deux volets défilants côte à côte.
 *   - la liste de gauche  : 399 px de large, DÉBORDE (des dizaines de fils) ;
 *   - le fil ouvert       : 1561 px de large, NE DÉBORDE PAS quand la
 *     conversation tient à l'écran (scrollHeight === clientHeight).
 * C'est ce second point qui cassait tout : élire le volet sur « il déborde en
 * ce moment » laissait la liste de gauche seule candidate.
 */
function pageDeuxVolets({ filDeborde = false } = {}) {
  const d = dom(`<body>
    <div id="liste" style="overflow-y: auto">
      <span dir="auto">Vous : Hello ! J'ai vu que vous etiez chirurgien-dentiste</span>
      <span dir="auto">Dr Lange Charlotte - Cabinet dentaire</span>
      <span dir="auto">sourires de Venasque</span>
    </div>
    <div id="fil" style="overflow-y: scroll">
      <span dir="auto">Hello ! J'ai vu que vous etiez estheticienne, c'est toujours le cas ?</span>
      <span dir="auto">Bonjour, oui c'est toujours le cas pourquoi ?</span>
    </div>
  </body>`);
  const doc = d.window.document;
  const liste = doc.getElementById("liste");
  const fil = doc.getElementById("fil");
  // La liste déborde toujours ; le fil seulement si la conversation est longue.
  Object.defineProperty(liste, "scrollHeight", { value: 4200 });
  Object.defineProperty(liste, "clientHeight", { value: 1013 });
  Object.defineProperty(fil, "scrollHeight", { value: filDeborde ? 3000 : 1180 });
  Object.defineProperty(fil, "clientHeight", { value: 1180 });

  const GEO = new Map([
    [liste, { left: 72, width: 399, height: 1013 }],
    [fil, { left: 472, width: 1561, height: 1180 }],
  ]);
  const rectOf = (el) => {
    if (GEO.has(el)) return GEO.get(el);
    // Sortant à droite du volet, entrant à gauche (mêmes ratios que le réel).
    const sortant = /Hello ! J'ai vu/.test(el.textContent || "");
    const rel = sortant ? 0.87 : 0.1;
    return { left: 472 + rel * 1561 - 50, width: 100, height: 20 };
  };
  return { doc, win: d.window, rectOf, liste, fil };
}

test("messageScroller: le volet de conversation gagne même quand il ne déborde pas", () => {
  const { doc, win, rectOf, fil } = pageDeuxVolets({ filDeborde: false });
  // Le bug du 04/08 : seule la liste de gauche débordait, elle était donc élue,
  // et l'IA recevait les apercus des AUTRES conversations.
  assert.equal(NMFDetect.messageScroller(doc, win, { rectOf }), fil);
  // Conversation longue : même résultat, pour la même raison (la largeur).
  const long = pageDeuxVolets({ filDeborde: true });
  assert.equal(NMFDetect.messageScroller(long.doc, long.win, { rectOf: long.rectOf }), long.fil);
});

test("conversationThread: sans scope explicite, ne lit QUE la conversation ouverte", () => {
  const { doc, win, rectOf } = pageDeuxVolets();
  const rows = NMFDetect.conversationThread(doc, { win, rectOf });
  assert.deepEqual(rows, [
    { from: "moi", text: "Hello ! J'ai vu que vous etiez estheticienne, c'est toujours le cas ?" },
    { from: "lui", text: "Bonjour, oui c'est toujours le cas pourquoi ?" },
  ]);
  // Aucun nom d'un autre prospect n'a fuité dans le fil.
  const tout = rows.map((r) => r.text).join(" ");
  for (const intrus of ["Dr Lange", "Venasque", "chirurgien-dentiste"]) {
    assert.ok(!tout.includes(intrus), `« ${intrus} » ne doit pas entrer dans le fil`);
  }
});

test("conversationThread: aucun volet reconnu → fil vide, jamais tout le document", () => {
  // Sans conteneur défilant, l'ancien repli sur `document.body` rendait la
  // page entière — un fil crédible mais faux, que l'IA refusait de traiter.
  // Le panneau, lui, sait dire « fil illisible » sur un tableau vide.
  const d = dom(`<body><div><span dir="auto">Dr Lange Charlotte</span>
    <span dir="auto">sourires de Venasque</span></div></body>`);
  assert.deepEqual(NMFDetect.conversationThread(d.window.document, { win: d.window }), []);
});

test("conversationThread: auteur déduit de l'alignement, dans l'ordre du fil", () => {
  const { doc, scope, rectOf } = threadDom([
    { text: "Hello Thomas ! Vous êtes toujours ostéopathe ?", side: "moi" },
    { text: "Salut, oui toujours en effet.", side: "lui" },
    { text: "Parfait ! Votre post est remonté dans mon feed.", side: "moi" },
    { text: "Je vous ecoute ! Dites moi", side: "lui" },
  ]);
  const rows = NMFDetect.conversationThread(doc, { scope, rectOf });
  assert.deepEqual(rows.map((r) => r.from), ["moi", "lui", "moi", "lui"]);
  assert.equal(rows[3].text, "Je vous ecoute ! Dites moi");
  assert.equal(NMFDetect.lastIncomingText(doc, { scope, rectOf }), "Je vous ecoute ! Dites moi");
});

test("conversationThread: carte de profil et horodatages écartés du fil", () => {
  // Tous présents dans le volet, aucun n'est un message.
  const { doc, scope, rectOf } = threadDom([
    { text: "thomas.pecoud_osteopathe · Instagram", side: null },
    { text: "Voir le profil", side: null },
    { text: "10:31", side: null },
    { text: "Modifié", side: null },
    { text: "Salut, oui toujours en effet.", side: "lui" },
  ]);
  const rows = NMFDetect.conversationThread(doc, { scope, rectOf });
  assert.deepEqual(rows, [{ from: "lui", text: "Salut, oui toujours en effet." }]);
});

test("conversationThread: message centré → « ? », on n'invente pas l'auteur", () => {
  const { doc, scope, rectOf } = threadDom([{ text: "message parfaitement centré", side: null }]);
  const rows = NMFDetect.conversationThread(doc, { scope, rectOf });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].from, "?");
  assert.deepEqual(NMFDetect.conversationThread(null), []);
});

test("lastIncomingText: rend le dernier message REÇU, pas le dernier envoyé", () => {
  const { doc, scope, rectOf } = threadDom([
    { text: "Hello ! Vous êtes toujours menuisier ?", side: "moi" },
    { text: "Oui toujours, c'est quoi votre tarif ?", side: "lui" },
    { text: "Je vous explique", side: "moi" },
  ]);
  assert.equal(NMFDetect.lastIncomingText(doc, { scope, rectOf }), "Oui toujours, c'est quoi votre tarif ?");
});

test("lastIncomingText: rien de plausible → null, jamais une exception", () => {
  assert.equal(NMFDetect.lastIncomingText(dom("<body><div>vide</div></body>").window.document), null);
  // Uniquement des messages sortants : rien à proposer.
  const sortants = threadDom([{ text: "yo, toujours là ?", side: "moi" }]);
  assert.equal(NMFDetect.lastIncomingText(sortants.doc, { scope: sortants.scope, rectOf: sortants.rectOf }), null);
  assert.equal(NMFDetect.lastIncomingText(null), null);
});

test("insertIntoComposer: remplace le contenu, ne l'ajoute PAS à la suite", async () => {
  const d = dom(`<body><div contenteditable="true" aria-label="Message">brouillon fautif</div></body>`);
  const node = NMFDetect.composerNode(d.window.document);
  // jsdom n'implémente pas execCommand : on simule un éditeur qui vide et
  // écrit via le pipeline d'édition, comme le fait Instagram.
  d.window.document.execCommand = (cmd, _ui, val) => {
    if (cmd === "selectAll") return true;
    if (cmd === "delete") { node.textContent = ""; return true; }
    if (cmd === "insertText") { node.textContent += val ?? ""; return true; }
    return false;
  };
  const ok = await NMFDetect.insertIntoComposer(node, "Brouillon corrigé.", { win: d.window, settleMs: 1 });
  assert.equal(ok, true);
  assert.equal(node.textContent, "Brouillon corrigé.", "le texte d'origine ne doit pas subsister devant");
});

test("insertIntoComposer: champ qu'on n'arrive pas à vider → on renonce, rien n'est ajouté", async () => {
  // Le bug réel : sélection inopérante ⇒ le texte partait à la suite, deux
  // fois. L'invariant « jamais écrire dans un champ non vide » l'interdit.
  const d = dom(`<body><div contenteditable="true" aria-label="Message">texte tenace</div></body>`);
  const node = NMFDetect.composerNode(d.window.document);
  d.window.document.execCommand = (cmd, _ui, val) => {
    if (cmd === "selectAll") return true;
    if (cmd === "delete") return true;            // prétend effacer, n'efface rien
    if (cmd === "insertText") { node.textContent += val ?? ""; return true; }
    return false;
  };
  const ok = await NMFDetect.insertIntoComposer(node, "Nouveau texte", { win: d.window, settleMs: 1 });
  assert.equal(ok, false);
  assert.equal(node.textContent, "texte tenace", "le champ doit rester intact");
});

test("insertIntoComposer: champ déjà vide → écriture directe", async () => {
  const d = dom(`<body><div contenteditable="true" aria-label="Message"></div></body>`);
  const node = NMFDetect.composerNode(d.window.document);
  d.window.document.execCommand = (cmd, _ui, val) => {
    if (cmd === "insertText") { node.textContent += val ?? ""; return true; }
    return cmd === "selectAll";
  };
  assert.equal(await NMFDetect.insertIntoComposer(node, "Hello", { win: d.window, settleMs: 1 }), true);
  assert.equal(node.textContent, "Hello");
  // Nœud absent : jamais d'exception.
  assert.equal(await NMFDetect.insertIntoComposer(null, "x", { win: d.window, settleMs: 1 }), false);
});

/** Liste de conversations façon Instagram : un avatar, un nom, un aperçu. */
function inboxDom(rows, oddHeights = {}) {
  const html = rows
    .map((r, i) => `<div data-i="${i}"><img alt="avatar" /><span>${r.name}</span><span>${r.preview}</span></div>`)
    .join("");
  const d = new JSDOM(`<body>${html}</body>`, { url: "https://www.instagram.com/direct/inbox/" });
  const rectOf = (el) => ({ height: oddHeights[el.getAttribute("data-i")] ?? 72, width: 399, left: 0 });
  return { doc: d.window.document, rectOf };
}

test("inboxWaiting: ne garde que les conversations où le PROSPECT a parlé en dernier", () => {
  const { doc, rectOf } = inboxDom([
    { name: "Thomas Pecoud", preview: "Et vous avez un portfolio ?" },
    { name: "Sun Nails", preview: "Vous: parfait alors bonne journée" },
    { name: "Open Fitness Club", preview: "A aimé un message" },
    { name: "Marine G", preview: "You: thanks!" },
    { name: "Beaute Dinterieur", preview: "Ça m'intéresse, on en parle quand ?" },
  ], {});
  const w = NMFDetect.inboxWaiting(doc, { rectOf });
  assert.deepEqual(w.map((x) => x.name), ["Thomas Pecoud", "Beaute Dinterieur"]);
  assert.equal(w[0].preview, "Et vous avez un portfolio ?");
});

test("inboxWaiting: les avis d'Instagram ne sont pas des réponses", () => {
  // Relevé sur la vraie boîte : sans ce filtre, le radar annonçait une réponse
  // là où personne n'avait écrit.
  const { doc, rectOf } = inboxDom([
    { name: "Lisa", preview: "Ce compte ne peut pas recevoir vos messages, car il n'autorise pas…" },
    { name: "Thomas", preview: "Et vous avez un portfolio ?" },
  ], {});
  assert.deepEqual(NMFDetect.inboxWaiting(doc, { rectOf }).map((x) => x.name), ["Thomas"]);
});

test("inboxWaiting: ce qui n'a pas la hauteur d'une conversation est écarté", () => {
  // Le bloc des notes en tête de liste a la même forme mais pas la même taille.
  const { doc, rectOf } = inboxDom([
    { name: "Donnez votre avis…", preview: "Votre note" },
    { name: "Thomas", preview: "Et vous avez un portfolio ?" },
    { name: "Karim", preview: "je vous écoute" },
  ], { 0: 140 });
  assert.deepEqual(NMFDetect.inboxWaiting(doc, { rectOf }).map((x) => x.name), ["Thomas", "Karim"]);
});

test("inboxWaiting: page sans liste → aucune alerte, jamais d'exception", () => {
  assert.deepEqual(NMFDetect.inboxWaiting(dom("<body><div>rien</div></body>").window.document), []);
  assert.deepEqual(NMFDetect.inboxWaiting(null), []);
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
