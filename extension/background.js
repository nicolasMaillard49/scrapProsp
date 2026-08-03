// extension/background.js
// TOUT le réseau de l'extension vit ici : émis du service worker, couvert par
// host_permissions → ni CORS ni préflight. Les content scripts n'appellent rien.
if (typeof importScripts === "function" && typeof NMFUtil === "undefined") importScripts("util.js");

if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

/** Réglages saisis dans les options. */
async function settings() {
  const { appUrl, extToken } = await chrome.storage.local.get(["appUrl", "extToken"]);
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
  const { status, json } = await api("/api/instagram/dm", {
    method: "POST",
    body: JSON.stringify({ prospect_id: armed.prospectId, account_id: armed.accountId, step: armed.step }),
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
      // sidepanel : « Insérer » cliqué — pose l'armement puis insère via content.
      case "ig:arm": {
        await setArmed({ prospectId: msg.prospectId, accountId: msg.accountId, step: msg.step });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) { sendResponse({ ok: false, reason: "no-tab" }); break; }
        const r = await chrome.tabs.sendMessage(tab.id, { type: "ig:insert", text: msg.text }).catch(() => null);
        sendResponse(r ?? { ok: false, reason: "no-content-script" });
        break;
      }
      // content.js : envoi détecté → journalise avec l'armement en cours.
      case "ig:sent": {
        const armed = await getArmed();
        if (!armed) { sendResponse({ ok: false, reason: "not-armed" }); break; }
        await setArmed(null); // consommé : une détection par armement
        const result = await logSend(armed);
        broadcast({ type: "ig:logged", ...result });
        sendResponse(result);
        break;
      }
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
