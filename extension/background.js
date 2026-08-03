// extension/background.js
// TOUT le réseau de l'extension vit ici : émis du service worker, couvert par
// host_permissions → ni CORS ni préflight. Les content scripts n'appellent rien.
if (typeof importScripts === "function" && typeof NMFUtil === "undefined") importScripts("util.js");

if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

/**
 * Amorce les réglages depuis `local-config.json` (fichier git-ignoré, présent
 * uniquement sur les machines où on l'a déposé). Évite la saisie manuelle dans
 * les options ; une valeur enregistrée via les options reste prioritaire.
 */
async function seedFromLocalConfig() {
  try {
    const res = await fetch(chrome.runtime.getURL("local-config.json"));
    if (!res.ok) return null;
    const cfg = await res.json();
    const appUrl = String(cfg.appUrl || "").trim().replace(/\/$/, "");
    const extToken = String(cfg.extToken || "").trim();
    if (!appUrl || !extToken) return null;
    await chrome.storage.local.set({ appUrl, extToken });
    return { appUrl, extToken };
  } catch {
    return null; // fichier absent ou invalide : les options restent la voie normale
  }
}

/** Réglages saisis dans les options (amorcés du fichier local s'ils manquent). */
async function settings() {
  let { appUrl, extToken } = await chrome.storage.local.get(["appUrl", "extToken"]);
  if (!appUrl || !extToken) {
    const seeded = await seedFromLocalConfig();
    if (seeded) ({ appUrl, extToken } = seeded);
  }
  return { appUrl: appUrl || "", extToken: extToken || "" };
}

async function api(path, init = {}) {
  const { appUrl, extToken } = await settings();
  if (!appUrl || !extToken) return { status: 0, json: { error: "Extension non configurée (options : URL + EXT_TOKEN)." } };
  try {
    const res = await fetch(`${appUrl}${path}`, {
      ...init,
      headers: { "x-ext-token": extToken, "Content-Type": "application/json", ...(init.headers || {}) },
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  } catch (e) {
    return { status: 0, json: { error: `App injoignable : ${e.message}` } };
  }
}

// ── Armement : posé par le sidepanel à « Insérer », consommé à « ig:sent ».
// storage.session : survit à la mort du service worker (MV3), meurt avec le
// navigateur — exactement la durée de vie d'une session de prospection.
async function getArmed() {
  const { armed } = await chrome.storage.session.get("armed");
  return armed || null;
}
async function setArmed(armed) {
  await chrome.storage.session.set({ armed });
}

/** Journalise un envoi, idempotent par (prospect, step, jour Paris). */
async function logSend(armed) {
  const { sentKeys = [] } = await chrome.storage.local.get("sentKeys");
  const key = NMFUtil.dedupeKey(armed.prospectId, armed.step, new Date());
  if (!NMFUtil.shouldLog(sentKeys, key)) {
    return { ok: true, deduped: true }; // double détection : déjà compté
  }
  // force: le message est DÉJÀ parti de la main de Nicolas. Le plafond ne peut
  // plus servir de refus ici — refuser d'inscrire un DM réel ne l'annule pas,
  // ça fausse juste les compteurs et le stade du prospect.
  const { status, json } = await api("/api/instagram/dm", {
    method: "POST",
    body: JSON.stringify({ prospect_id: armed.prospectId, account_id: armed.accountId, step: armed.step, force: true }),
  });
  if (status === 200 && json.ok) {
    await chrome.storage.local.set({ sentKeys: NMFUtil.prune([...sentKeys, key]) });
    return { ok: true, counters: json.counters };
  }
  return { ok: false, error: json.error || `Erreur ${status}` };
}

const broadcast = (msg) => chrome.runtime.sendMessage(msg).catch(() => {});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      // content.js : la conversation/le profil affiché a changé.
      case "ig:prospect":
        await chrome.storage.session.set({ current: { username: msg.username, account: msg.account } });
        broadcast({ type: "ig:prospect-changed", username: msg.username, account: msg.account });
        sendResponse({ ok: true });
        break;
      // sidepanel : donne-moi la trame de ce pseudo (ou le contexte courant).
      case "ig:get-trame": {
        const { current } = await chrome.storage.session.get("current");
        const username = msg.username ?? current?.username ?? "";
        const { status, json } = await api(`/api/instagram/trame?username=${encodeURIComponent(username)}`);
        sendResponse({ status, data: json, context: current || null });
        break;
      }
      // sidepanel : « Insérer » cliqué — insère d'abord via content, n'arme la
      // journalisation QUE si l'insertion a réussi (sinon rien à journaliser).
      case "ig:arm": {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) { sendResponse({ ok: false, reason: "no-tab" }); break; }
        const r = await chrome.tabs.sendMessage(tab.id, { type: "ig:insert", text: msg.text }).catch(() => null);
        if (!r?.ok) { sendResponse(r ?? { ok: false, reason: "no-content-script" }); break; }
        // Mémorise le pseudo de la conversation courante : si elle change
        // avant l'envoi détecté, l'armement ne doit pas fuiter sur le
        // nouveau prospect affiché (ig:sent le vérifiera).
        const { current } = await chrome.storage.session.get("current");
        await setArmed({ prospectId: msg.prospectId, accountId: msg.accountId, step: msg.step, username: current?.username ?? null });
        sendResponse(r);
        break;
      }
      // sidepanel : le prospect est sorti de la trame — propose des réponses.
      // Lecture seule : rien n'est journalisé, rien n'est envoyé.
      case "ig:ai-reply": {
        const { current } = await chrome.storage.session.get("current");
        const { status, json } = await api("/api/instagram/reply-ai", {
          method: "POST",
          body: JSON.stringify({
            username: msg.username ?? current?.username ?? "",
            incoming: msg.incoming ?? "",
            history: msg.history ?? "",
          }),
        });
        sendResponse({ status, data: json });
        break;
      }
      // sidepanel : correction orthographique du texte du champ. Lecture
      // seule côté app ; le remplacement dans le champ se fait côté panneau.
      case "ig:proofread": {
        const { status, json } = await api("/api/instagram/proofread", {
          method: "POST",
          body: JSON.stringify({ text: msg.text ?? "" }),
        });
        sendResponse({ status, data: json });
        break;
      }
      // content.js : envoi détecté → journalise avec l'armement en cours.
      case "ig:sent": {
        const armed = await getArmed();
        if (!armed) { sendResponse({ ok: false, reason: "not-armed" }); break; }
        if (armed.username) {
          const { current } = await chrome.storage.session.get("current");
          if (current?.username !== armed.username) {
            // La conversation a changé entre l'armement et l'envoi détecté :
            // on ne sait plus à qui attribuer l'envoi → pas de journalisation.
            await setArmed(null);
            broadcast({ type: "ig:logged", ok: false, error: "Conversation changée — journalisation annulée (utilise le bouton Envoyé si le message est bien parti)." });
            sendResponse({ ok: false, reason: "context-changed" });
            break;
          }
        }
        await setArmed(null); // consommé : une détection par armement
        const result = await logSend(armed);
        broadcast({ type: "ig:logged", ...result });
        sendResponse(result);
        break;
      }
      // content.js : changement de conversation détecté — désarme (l'armement
      // ne survit jamais à un changement de conversation).
      case "ig:disarm":
        await setArmed(null);
        sendResponse({ ok: true });
        break;
      // sidepanel : filet manuel (« Envoyé ») — même chemin, même idempotence.
      case "ig:sent-manual": {
        await setArmed(null);
        const result = await logSend({ prospectId: msg.prospectId, accountId: msg.accountId, step: msg.step });
        broadcast({ type: "ig:logged", ...result });
        sendResponse(result);
        break;
      }
      default:
        sendResponse({ ok: false, reason: "unknown" });
    }
  })();
  return true; // réponse asynchrone
});
