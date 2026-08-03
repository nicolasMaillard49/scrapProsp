// extension/content.js
// Observation de la SPA Instagram + insertion + détection d'envoi.
// AUCUN fetch ici (CORS de la page) : tout le réseau vit dans background.js.
// AUCUN clic programmatique sur « Envoyer » — l'humain envoie.

(() => {
  let lastAnnounced = "";
  let unwatch = () => {};

  /** Annonce le contexte courant (pseudo affiché + compte connecté). */
  function announce() {
    const username = NMFDetect.currentUsername(location, document);
    const account = NMFDetect.loggedInAccount(document);
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
      // Insertion via execCommand : Instagram (React/Lexical) ignore une
      // écriture directe de textContent — execCommand passe par le pipeline
      // d'édition du navigateur, que l'éditeur écoute.
      node.focus();
      const sel = window.getSelection();
      sel.selectAllChildren(node);
      document.execCommand("insertText", false, msg.text);
      // Arme la détection d'envoi (one-shot). Ré-armer remplace l'ancienne.
      unwatch();
      unwatch = NMFDetect.watchSend(node, () => {
        chrome.runtime.sendMessage({ type: "ig:sent" }).catch(() => {});
      });
      sendResponse({ ok: true });
    }
    // Le sidepanel peut demander un re-scan explicite (à son ouverture).
    if (msg?.type === "ig:rescan") {
      lastAnnounced = "";
      announce();
      sendResponse({ ok: true });
    }
  });
})();
