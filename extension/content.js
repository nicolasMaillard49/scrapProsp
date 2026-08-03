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

  // ── Auto-journalisation : surveille TOUT ce qui part du champ ────────────
  // Nicolas écrit souvent à la main, sans passer par « Insérer ». Ces envois
  // n'étaient jamais journalisés, et le stade décrochait de la conversation.
  // On mémorise le dernier brouillon non vide ; quand le champ se vide, c'est
  // qu'il est parti — le service worker décidera s'il correspond à une étape.
  let lastDraft = "";
  setInterval(() => {
    const node = NMFDetect.composerNode(document);
    const now = node ? (node.textContent || "").trim() : "";
    if (!now && lastDraft) {
      const sent = lastDraft;
      lastDraft = "";
      chrome.runtime.sendMessage({ type: "ig:sent-auto", text: sent }).catch(() => {});
      return;
    }
    if (now) lastDraft = now;
  }, 500);

  // ── Réponses reçues : détection dans la conversation ouverte ─────────────
  // Le pendant entrant de l'auto-journalisation. Sans lui, une réponse lue et
  // traitée à la main ne laissait AUCUNE trace au CRM : le prospect restait
  // dans la file de relance et le taux de réponse était sous-compté.
  // On pousse le fil brut ; c'est le service worker qui tranche (il a la
  // trame, donc les messages qui sont de nous) et qui appelle l'app.
  let lastIncomingSeen = "";
  const pushIncoming = () => {
    const username = NMFDetect.currentUsername(location, document);
    if (!username) return;
    const rows = NMFDetect.conversationThread(document, { username });
    if (!rows.length) return;
    // On ne se limite PAS aux fils qui se terminent par son message : Nicolas
    // répond dans la foulée, et sa réponse effacerait la trace de celle du
    // prospect. La signature suit le dernier message ENTRANT, pas le dernier
    // message tout court.
    let lastIn = null;
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].from === "lui") { lastIn = rows[i]; break; }
    if (!lastIn) return;
    const sig = `${username}|${String(lastIn.text || "").slice(0, 140)}`;
    if (sig === lastIncomingSeen) return; // déjà poussé : rien de neuf à l'écran
    lastIncomingSeen = sig;
    chrome.runtime.sendMessage({ type: "ig:incoming", username, rows }).catch(() => {});
  };
  setInterval(pushIncoming, 4000);

  // Radar : combien de conversations attendent une réponse. Poussé au service
  // worker, qui en fait un badge sur l'icône.
  const pushInboxCount = () => {
    const n = NMFDetect.inboxWaiting(document).length;
    chrome.runtime.sendMessage({ type: "ig:inbox-count", count: n }).catch(() => {});
  };
  setTimeout(pushInboxCount, 3000);
  setInterval(pushInboxCount, 60000);

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
      // Asynchrone : l'insertion vide le champ, laisse l'éditeur se
      // réconcilier, puis vérifie. On ne répond « ok » que si le champ
      // contient réellement le texte — annoncer un succès qui n'a pas eu lieu
      // envoie chercher le bug au mauvais endroit (cf. « Corrigé ✓ » sans effet).
      NMFDetect.insertIntoComposer(node, msg.text).then((ok) => {
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
      });
      return true; // réponse asynchrone
    } else if (msg?.type === "ig:navigate") {
      // Navigation demandée par le panneau (file du jour).
      location.assign(msg.url);
      sendResponse({ ok: true });
    } else if (msg?.type === "ig:inbox") {
      sendResponse({ rows: NMFDetect.inboxWaiting(document) });
    } else if (msg?.type === "ig:open-inbox") {
      // Clic de NAVIGATION uniquement — jamais sur « Envoyer ».
      sendResponse({ ok: NMFDetect.openInboxRow(document, msg.index) });
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
