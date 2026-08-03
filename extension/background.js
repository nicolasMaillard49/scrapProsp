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

/** Trame du prospect affiché, mise en cache le temps de la conversation. */
async function currentTrame() {
  const { current } = await chrome.storage.session.get("current");
  const username = current?.username;
  if (!username) return null;
  const { cachedTrame } = await chrome.storage.session.get("cachedTrame");
  if (cachedTrame?.username === username) return cachedTrame.payload;
  const { status, json } = await api(`/api/instagram/trame?username=${encodeURIComponent(username)}`);
  if (status !== 200 || !json?.steps) return null;
  await chrome.storage.session.set({ cachedTrame: { username, payload: json } });
  return json;
}

/** Compte émetteur à créditer, d'après la trame et le compte détecté. */
async function currentAccountId(payload) {
  const { current } = await chrome.storage.session.get("current");
  return NMFUtil.pickAccountId(payload?.accounts ?? [], current?.account ?? null);
}

// ── Pont vers la page Instagram ────────────────────────────────────────────

/** Onglet actif, s'il est bien sur instagram.com. */
async function instagramTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { id: null, reason: "no-tab" };
  if (!/^https:\/\/www\.instagram\.com\//.test(tab.url || "")) return { id: null, reason: "not-instagram" };
  return { id: tab.id, reason: null };
}

/**
 * Garantit que les content scripts tournent dans l'onglet.
 *
 * Recharger l'extension ORPHELINE les scripts déjà injectés : la page reste
 * ouverte, mais plus rien de l'extension n'y vit — insertion, détection du
 * prospect et lecture du champ échouent toutes en même temps, sans erreur
 * visible. On ping, et on ré-injecte au besoin : Nicolas n'a jamais à
 * recharger sa page après une mise à jour.
 */
async function ensureContent(tabId) {
  const pong = await chrome.tabs.sendMessage(tabId, { type: "ig:ping" }).catch(() => null);
  if (pong?.ok) return true;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["detect.js", "content.js"] });
    return true;
  } catch {
    return false;
  }
}

/** Envoie un message à la page, en s'assurant d'abord qu'elle peut l'entendre. */
async function sendToTab(payload) {
  const { id, reason } = await instagramTab();
  if (!id) return { ok: false, reason };
  if (!(await ensureContent(id))) return { ok: false, reason: "no-content-script" };
  return (await chrome.tabs.sendMessage(id, payload).catch(() => null)) ?? { ok: false, reason: "no-content-script" };
}

// ── Raccourcis clavier ──────────────────────────────────────────────────────
// À 50 DM/jour, chaque aller-retour souris casse le flux. Le service worker
// exécute directement l'action : elle marche même panneau fermé.
if (chrome.commands) {
  chrome.commands.onCommand.addListener(async (command) => {
    try {
      if (command === "insert-next") {
        const payload = await currentTrame();
        const step = payload?.steps?.find((s) => s.step === payload.nextStep);
        if (!step) return;
        const accountId = await currentAccountId(payload);
        const r = await sendToTab({ type: "ig:insert", text: step.text });
        if (r?.ok && payload.prospect?.id && accountId) {
          const { current } = await chrome.storage.session.get("current");
          await setArmed({ prospectId: payload.prospect.id, accountId, step: step.step, username: current?.username ?? null });
        }
        broadcast({ type: "ig:shortcut", command, ok: !!r?.ok });
      } else if (command === "fix-spelling") {
        const c = await sendToTab({ type: "ig:composer-text" });
        const text = (c?.text ?? "").trim();
        if (!text) return;
        const { status, json } = await api("/api/instagram/proofread", { method: "POST", body: JSON.stringify({ text }) });
        if (status === 200 && json.changed) await sendToTab({ type: "ig:insert", text: json.text });
        broadcast({ type: "ig:shortcut", command, ok: status === 200 });
      } else if (command === "next-prospect") {
        broadcast({ type: "ig:shortcut", command });
        const { status, json } = await api("/api/instagram/queue");
        const next = status === 200 ? json.next?.[0] : null;
        if (next?.username) {
          const { id } = await instagramTab();
          if (id) await chrome.tabs.update(id, { url: `https://www.instagram.com/${next.username}/` });
        }
      }
    } catch { /* un raccourci ne doit jamais faire tomber le service worker */ }
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      // content.js : la conversation/le profil affiché a changé.
      case "ig:prospect":
        await chrome.storage.session.set({ current: { username: msg.username, account: msg.account } });
        await chrome.storage.session.remove("cachedTrame"); // autre prospect, autre trame
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
      // sidepanel → page : tout passe par ici, content scripts garantis.
      case "ig:tab":
        sendResponse(await sendToTab(msg.payload));
        break;
      case "ig:arm": {
        const r = await sendToTab({ type: "ig:insert", text: msg.text });
        if (!r?.ok) { sendResponse(r); break; }
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
      // sidepanel : qualification de la réponse à froid, puis — sur validation
      // explicite (record: true) — inscription au CRM. Idempotent par
      // (prospect, jour Paris) : une double validation ne compte pas deux
      // réponses, ce qui gonflerait les KPI d'accroche.
      case "ig:classify": {
        if (msg.record) {
          const { replyKeys = [] } = await chrome.storage.local.get("replyKeys");
          const key = NMFUtil.replyKey(msg.username, new Date());
          if (!NMFUtil.shouldLog(replyKeys, key)) {
            sendResponse({ status: 200, data: { ok: true, deduped: true } });
            break;
          }
          const res = await api("/api/instagram/classify-reply", {
            method: "POST",
            body: JSON.stringify({
              username: msg.username,
              record: true,
              kind: msg.kind,
              excerpt: msg.excerpt,
              account_id: msg.accountId ?? null,
            }),
          });
          if (res.status === 200 && res.json.ok) {
            await chrome.storage.local.set({ replyKeys: NMFUtil.prune([...replyKeys, key]) });
          }
          sendResponse({ status: res.status, data: res.json });
          break;
        }
        const { status, json } = await api("/api/instagram/classify-reply", {
          method: "POST",
          body: JSON.stringify({ username: msg.username, history: msg.history ?? "" }),
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
      // sidepanel : reformulation de la phrase en trois tons. Lecture seule
      // côté app ; c'est le panneau qui insère la variante retenue — et qui
      // désarme en le faisant, puisque le texte n'est plus celui de l'étape.
      case "ig:retone": {
        const { current } = await chrome.storage.session.get("current");
        const { status, json } = await api("/api/instagram/retone", {
          method: "POST",
          body: JSON.stringify({
            username: msg.username ?? current?.username ?? "",
            text: msg.text ?? "",
            history: msg.history ?? "",
          }),
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
      // content.js : un message vient de partir du champ, sans être passé par
      // « Insérer ». On le rattache à une étape de la trame par ressemblance,
      // et on ne journalise QUE si la correspondance est nette — journaliser
      // la mauvaise étape fausserait le stade et la relance.
      case "ig:sent-auto": {
        const armed = await getArmed();
        if (armed) { sendResponse({ ok: false, reason: "armed" }); break; } // ig:sent s'en charge
        const payload = await currentTrame();
        const prospectId = payload?.prospect?.id;
        if (!prospectId) { sendResponse({ ok: false, reason: "no-prospect" }); break; }
        const hit = NMFUtil.matchStep(msg.text ?? "", payload.steps ?? []);
        if (!hit) { sendResponse({ ok: false, reason: "no-match" }); break; }
        const accountId = await currentAccountId(payload);
        if (!accountId) { sendResponse({ ok: false, reason: "no-account" }); break; }
        const result = await logSend({ prospectId, accountId, step: hit.step });
        await chrome.storage.session.remove("cachedTrame"); // le stade a bougé
        broadcast({ type: "ig:logged", ...result, auto: hit.step });
        sendResponse(result);
        break;
      }
      // content.js : le prospect a parlé en dernier dans la conversation
      // ouverte → qualifie, et inscrit la réponse au CRM si le modèle est SÛR.
      // Le doute n'est jamais écrit : il remonte au panneau pour un clic.
      case "ig:incoming": {
        const payload = await currentTrame();
        const prospectId = payload?.prospect?.id;
        if (!prospectId) { sendResponse({ ok: false, reason: "no-prospect" }); break; }

        const steps = (payload.steps ?? []).map((s) => s.text);
        const hit = NMFUtil.pendingIncoming(msg.rows ?? [], steps);
        if (!hit) { sendResponse({ ok: false, reason: "no-incoming" }); break; }

        const username = msg.username;
        // Borne l'APPEL au modèle : un fil laissé à l'écran ne doit pas
        // relancer la qualification toutes les 4 s, y compris quand elle ne
        // conclut rien.
        const { seenIncoming = [] } = await chrome.storage.session.get("seenIncoming");
        const msgKey = NMFUtil.incomingKey(username, hit.text);
        if (seenIncoming.includes(msgKey)) { sendResponse({ ok: false, reason: "seen" }); break; }
        await chrome.storage.session.set({ seenIncoming: NMFUtil.prune([...seenIncoming, msgKey], 100) });

        // Borne l'ÉCRITURE : même clé que la validation manuelle, pour que les
        // deux chemins ne comptent jamais deux réponses le même jour.
        const { replyKeys = [] } = await chrome.storage.local.get("replyKeys");
        const dayKey = NMFUtil.replyKey(username, new Date());
        if (!NMFUtil.shouldLog(replyKeys, dayKey)) { sendResponse({ ok: false, reason: "deduped" }); break; }

        const accountId = await currentAccountId(payload);
        const { status, json } = await api("/api/instagram/classify-reply", {
          method: "POST",
          body: JSON.stringify({
            username,
            history: NMFUtil.formatThread(msg.rows ?? [], steps),
            auto: true,
            account_id: accountId ?? null,
          }),
        });
        if (status !== 200 || !json?.verdict) {
          broadcast({ type: "ig:reply-logged", ok: false, error: json?.error || `Erreur ${status}` });
          sendResponse({ ok: false, reason: "api", error: json?.error });
          break;
        }
        const auto = json.auto ?? { recorded: false, reason: "doute" };
        if (auto.recorded) {
          await chrome.storage.local.set({ replyKeys: NMFUtil.prune([...replyKeys, dayKey]) });
          await chrome.storage.session.remove("cachedTrame"); // stade et file ont bougé
        }
        broadcast({ type: "ig:reply-logged", ok: true, username, auto, verdict: json.verdict });
        sendResponse({ ok: true, auto });
        break;
      }
      // content.js : nombre de conversations en attente → badge sur l'icône.
      case "ig:inbox-count": {
        const n = Number(msg.count) || 0;
        await chrome.action.setBadgeText({ text: n > 0 ? String(n) : "" });
        await chrome.action.setBadgeBackgroundColor({ color: "#7B4FE0" });
        sendResponse({ ok: true });
        break;
      }
      // sidepanel : file de prospection du jour (lecture seule).
      case "ig:queue": {
        const { status, json } = await api("/api/instagram/queue");
        sendResponse({ status, data: json });
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
