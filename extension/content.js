// extension/content.js
// Observation de la SPA Instagram + insertion + détection d'envoi.
// AUCUN fetch ici (CORS de la page) : tout le réseau vit dans background.js.
// AUCUN clic programmatique sur « Envoyer » — l'humain envoie.

(() => {
  // Ré-injection après un rechargement de l'extension : sans cette garde, on
  // empilerait un second intervalle et un second écouteur de messages, chacun
  // répondant à la même requête.
  if (window.__nmfTrameContent) return;
  window.__nmfTrameContent = true;

  let lastAnnounced = "";
  let unwatch = () => {};

  /** Annonce le contexte courant (pseudo affiché + compte connecté). */
  function announce() {
    // Le compte connecté d'abord, par les seules sources qui ne peuvent pas
    // désigner un tiers (nav, JSON) : il sert ensuite à ne pas confondre
    // Nicolas avec son interlocuteur, dans un sens comme dans l'autre.
    const own = NMFDetect.loggedInAccount(document, { strict: true });
    const username = NMFDetect.currentUsername(location, document, { exclude: own });
    const account = own || NMFDetect.loggedInAccount(document, { exclude: username });
    const key = `${username}|${account}`;
    if (key === lastAnnounced) return;
    lastAnnounced = key;
    chrome.runtime.sendMessage({ type: "ig:prospect", username, account }).catch(() => {});
  }

  // Instagram est une SPA : pas de rechargement entre conversations. On
  // surveille l'URL (léger) et on re-scanne peu après le changement, le temps
  // que le header de la conversation soit rendu.
  let lastHref = "";
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      // Un armement ne survit jamais à un changement de conversation : on
      // arrête la détection d'envoi en cours et on désarme côté background.
      unwatch();
      unwatch = () => {};
      chrome.runtime.sendMessage({ type: "ig:disarm" }).catch(() => {});
      setTimeout(announce, 800);
      setTimeout(announce, 2500); // 2e passe : header parfois lent à monter
    }
  }, 500);
  announce();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "ig:insert") {
      const node = NMFDetect.composerNode(document);
      if (!node) {
        sendResponse({ ok: false, reason: "no-composer" });
        return;
      }
      // On ne répond « ok » que si le champ contient réellement le texte —
      // annoncer un succès qui n'a pas eu lieu envoie chercher le bug au
      // mauvais endroit (cf. « Corrigé ✓ » sans effet).
      const ok = NMFDetect.insertIntoComposer(node, msg.text);
      if (!ok) {
        sendResponse({ ok: false, reason: "insert-failed" });
        return;
      }
      // Arme la détection d'envoi (one-shot). Ré-armer remplace l'ancienne.
      unwatch();
      unwatch = NMFDetect.watchSend(node, () => {
        chrome.runtime.sendMessage({ type: "ig:sent" }).catch(() => {});
      });
      sendResponse({ ok: true });
    } else if (msg?.type === "ig:ping") {
      // Sert au service worker à savoir si ce script est encore vivant.
      sendResponse({ ok: true });
    } else if (msg?.type === "ig:composer-text") {
      const node = NMFDetect.composerNode(document);
      sendResponse({ text: node ? (node.innerText || node.textContent || "") : null });
    } else if (msg?.type === "ig:thread") {
      // Lecture seule du fil : alimente le bloc « réponse IA ». Le pseudo du
      // prospect aide à reconnaître son avatar donc ses messages.
      sendResponse({
        rows: NMFDetect.conversationThread(document, {
          username: msg.username || NMFDetect.currentUsername(location, document),
        }),
      });
    } else if (msg?.type === "ig:rescan") {
      // Le sidepanel peut demander un re-scan explicite (à son ouverture).
      lastAnnounced = "";
      announce();
      sendResponse({ ok: true });
    }
  });
})();
