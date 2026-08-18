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

// Envois en cours d'inscription, dans CE service worker. `sentKeys` (storage)
// ne suffit pas à lui seul : il est lu avant l'appel réseau et écrit après, si
// bien que deux détections du même message — « Insérer » puis le champ qui se
// vide, à la milliseconde près — franchissaient toutes les deux la porte et
// journalisaient deux fois. Ce Set-là est consulté et rempli de façon
// SYNCHRONE : rien ne peut s'intercaler entre le test et la réservation.
const enCours = new Set();

/** Journalise un envoi, idempotent par (prospect, step, jour Paris). */
async function logSend(armed) {
  const key = NMFUtil.dedupeKey(armed.prospectId, armed.step, new Date());
  if (enCours.has(key)) return { ok: true, deduped: true }; // même message, détecté deux fois
  enCours.add(key);
  try {
    const { sentKeys = [] } = await chrome.storage.local.get("sentKeys");
    if (!NMFUtil.shouldLog(sentKeys, key)) {
      return { ok: true, deduped: true }; // déjà compté (session précédente comprise)
    }
    // force: le message est DÉJÀ parti de la main de Nicolas. Le plafond ne peut
    // plus servir de refus ici — refuser d'inscrire un DM réel ne l'annule pas,
    // ça fausse juste les compteurs et le stade du prospect.
    const { status, json } = await api("/api/instagram/dm", {
      method: "POST",
      body: JSON.stringify({
        prospect_id: armed.prospectId, account_id: armed.accountId, step: armed.step, force: true,
        // La variante d'accroche voyage avec l'envoi : c'est le seul moment où
        // l'on sait laquelle est réellement partie.
        variant: armed.variant ?? null,
      }),
    });
    if (status === 200 && json.ok) {
      // L'app peut répondre « déjà journalisé » (contrainte d'unicité) : le
      // message est bien parti, mais il ne compte pas une deuxième fois dans la
      // cadence. On retient quand même la clé — inutile de la reposter.
      const { paceStamps = [] } = await chrome.storage.local.get("paceStamps");
      await chrome.storage.local.set({
        sentKeys: NMFUtil.prune([...sentKeys, key]),
        ...(json.deduped ? {} : { paceStamps: NMFUtil.pushSend(paceStamps, Date.now()) }),
      });
      return json.deduped ? { ok: true, deduped: true } : { ok: true, counters: json.counters };
    }
    return { ok: false, error: json.error || `Erreur ${status}` };
  } finally {
    // Libéré quoi qu'il arrive : un échec réseau ne doit pas condamner le
    // prospect pour la journée — le filet manuel « Envoyé » doit pouvoir
    // rattraper le coup.
    enCours.delete(key);
  }
}

const broadcast = (msg) => chrome.runtime.sendMessage(msg).catch(() => {});

/**
 * Trame du prospect affiché, mise en cache le temps de la conversation.
 *
 * Le choix de trame du panneau est relu ici aussi : sans ça, `Alt+I` insérerait
 * M1 pendant que le panneau affiche S1 — le raccourci doit envoyer EXACTEMENT
 * ce que le panneau montre, sinon il devient impossible à faire de confiance.
 * Il entre dans la clé de cache : changer de trame doit changer la partition.
 */
async function currentTrame() {
  const { current } = await chrome.storage.session.get("current");
  const username = current?.username;
  if (!username) return null;
  const { trameChoice = {} } = await chrome.storage.local.get("trameChoice");
  const trame = trameChoice[username] ?? null;
  const { cachedTrame } = await chrome.storage.session.get("cachedTrame");
  if (cachedTrame?.username === username && cachedTrame?.trame === trame) return cachedTrame.payload;
  // La réserve du préchargement, si elle porte bien ce prospect. Elle a été
  // constituée SANS choix de trame explicite : on ne s'en sert donc que dans
  // ce cas-là, sinon on servirait la mauvaise partition.
  if (!trame) {
    const ready = await takePrefetched(username);
    if (ready) {
      await chrome.storage.session.set({ cachedTrame: { username, trame, payload: ready } });
      void prefetchNext(); // la réserve est consommée : on refait le plein
      return ready;
    }
  }
  const q = trame ? `&trame=${encodeURIComponent(trame)}` : "";
  const { status, json } = await api(`/api/instagram/trame?username=${encodeURIComponent(username)}${q}`);
  if (status !== 200 || !json?.steps) return null;
  await chrome.storage.session.set({ cachedTrame: { username, trame, payload: json } });
  return json;
}

/** Au-delà, la réserve porte des compteurs de quota périmés : on la jette. */
const PREFETCH_TTL_MS = 5 * 60 * 1000;

/** La réserve, si elle porte bien ce prospect ET qu'elle est encore fraîche. */
async function takePrefetched(username) {
  const { prefetched } = await chrome.storage.session.get("prefetched");
  if (!prefetched || prefetched.username !== username) return null;
  await chrome.storage.session.remove("prefetched");
  if (Date.now() - (prefetched.at ?? 0) > PREFETCH_TTL_MS) return null;
  return prefetched.payload;
}

/**
 * Préchargement spéculatif du prospect suivant.
 *
 * Pendant qu'on écrit à @a, on charge déjà la trame de @b — sa partition, son
 * fait concurrentiel, sa maquette. Sur une session de 50 DM, ce sont 50 fois
 * trois secondes d'attente qui disparaissent : ce sont ces trois secondes qui
 * font ouvrir un autre onglet, et l'autre onglet qui coûte la session.
 *
 * Lecture seule, une seule requête, et jamais bloquante : si elle échoue ou
 * arrive trop tard, le chemin normal reprend exactement comme avant.
 */
async function prefetchNext() {
  try {
    const { status, json } = await api("/api/instagram/queue");
    const next = status === 200 ? json.next?.[0]?.username : null;
    if (!next) return;
    const { prefetched } = await chrome.storage.session.get("prefetched");
    if (prefetched?.username === next) return; // déjà en réserve
    const r = await api(`/api/instagram/trame?username=${encodeURIComponent(next)}`);
    if (r.status !== 200 || !r.json?.steps) return;
    await chrome.storage.session.set({ prefetched: { username: next, payload: r.json, at: Date.now() } });
  } catch { /* le préchargement ne doit jamais faire tomber le service worker */ }
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

// ── Pilote assisté : l'humain envoie, l'extension prépare le suivant ──────

async function assistEnabled() {
  const { assistMode } = await chrome.storage.local.get("assistMode");
  return assistMode === true;
}

async function stopAssistPreparation(reason) {
  await chrome.storage.session.remove("assistPending");
  broadcast({ type: "ig:assist", state: "stopped", error: reason });
}

/** Ouvre le champ du profil déjà affiché, y insère son accroche et l'arme. */
async function prepareAssist(pending) {
  await chrome.storage.session.set({ assistPending: { ...pending, preparing: true, startedAt: Date.now() } });
  const opened = await sendToTab({ type: "ig:prepare-contact" });
  if (!opened?.ok) {
    await stopAssistPreparation(opened?.reason === "no-contact-button"
      ? "Bouton Message introuvable — pilote arrêté sur ce profil."
      : "Conversation impossible à ouvrir — pilote arrêté sur ce profil.");
    return;
  }

  const payload = await currentTrame();
  const step = payload?.steps?.find((s) => s.step === payload.nextStep);
  if (!payload?.prospect?.id || !step || !["M1", "S1"].includes(step.step)) {
    await stopAssistPreparation("Aucune accroche M1 à préparer — pilote arrêté.");
    return;
  }
  const accountId = await currentAccountId(payload);
  if (!accountId) {
    await stopAssistPreparation("Compte émetteur indéterminé — pilote arrêté.");
    return;
  }
  const inserted = await sendToTab({ type: "ig:insert", text: step.text });
  if (!inserted?.ok) {
    await stopAssistPreparation("M1 non inséré — pilote arrêté, utilise le bouton Insérer.");
    return;
  }
  await setArmed({
    prospectId: payload.prospect.id,
    accountId,
    step: step.step,
    variant: payload.variantId ?? null,
    username: pending.username,
  });
  await chrome.storage.session.remove("assistPending");
  broadcast({ type: "ig:assist", state: "ready", username: pending.username, step: step.step });
}

/** Reprend une préparation quand le profil suivant vient d'être rendu. */
async function maybePrepareAssist(username) {
  if (!username || !(await assistEnabled())) return;
  const { assistPending } = await chrome.storage.session.get("assistPending");
  if (!assistPending || assistPending.username !== username) return;
  // Une seconde annonce de la SPA ne doit pas ouvrir/insérer deux fois. Après
  // 15 s, on autorise toutefois la reprise si le service worker s'est arrêté.
  if (assistPending.preparing && Date.now() - (assistPending.startedAt ?? 0) < 15_000) return;
  await prepareAssist(assistPending);
}

/** Après l'Entrée humaine sur M1/S1, positionne le prochain profil. */
async function advanceAssist(armed, result) {
  const enabled = await assistEnabled();
  if (!NMFUtil.shouldAdvanceAssist(enabled, armed?.step, result)) return;
  const { status, json } = await api("/api/instagram/queue");
  const next = status === 200 ? json.next?.[0] : null;
  if (!next?.username) {
    broadcast({ type: "ig:assist", state: "done" });
    return;
  }
  const { id } = await instagramTab();
  if (!id) {
    broadcast({ type: "ig:assist", state: "stopped", error: "Onglet Instagram introuvable — pilote arrêté." });
    return;
  }
  await chrome.storage.session.set({ assistPending: { username: next.username, preparing: false, startedAt: 0 } });
  broadcast({ type: "ig:assist", state: "moving", username: next.username });
  await chrome.tabs.update(id, { url: `https://www.instagram.com/${next.username}/` });
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
          await setArmed({
            prospectId: payload.prospect.id, accountId, step: step.step,
            variant: payload.variantId ?? null, username: current?.username ?? null,
          });
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
        void prefetchNext(); // on charge le suivant pendant qu'il écrit celui-ci
        broadcast({ type: "ig:prospect-changed", username: msg.username, account: msg.account });
        await maybePrepareAssist(msg.username);
        sendResponse({ ok: true });
        break;
      // sidepanel : donne-moi la trame de ce pseudo (ou le contexte courant).
      case "ig:get-trame": {
        const { current } = await chrome.storage.session.get("current");
        const username = msg.username ?? current?.username ?? "";
        // `trame` n'est transmise que si le panneau l'a explicitement choisie :
        // sans elle, l'app déduit du journal d'envois quelle trame est déjà
        // engagée avec ce prospect. Envoyer « standard » par défaut écraserait
        // cette déduction et ferait repartir une conversation site en standard.
        const q = msg.trame ? `&trame=${encodeURIComponent(msg.trame)}` : "";
        // Réserve du préchargement : même règle qu'ailleurs, elle ne vaut que
        // sans choix de trame explicite (elle a été constituée sans).
        if (!msg.trame && username) {
          const ready = await takePrefetched(username);
          if (ready) {
            void prefetchNext();
            sendResponse({ status: 200, data: ready, context: current || null });
            break;
          }
        }
        const { status, json } = await api(`/api/instagram/trame?username=${encodeURIComponent(username)}${q}`);
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
        await setArmed({
          prospectId: msg.prospectId, accountId: msg.accountId, step: msg.step,
          variant: msg.variant ?? null, username: current?.username ?? null,
        });
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
            // Le modèle doit ramener vers l'étape de la trame RÉELLEMENT
            // affichée : sans ça il propose un retour vers M7 pendant que le
            // panneau déroule S3.
            trame: msg.trame ?? null,
          }),
        });
        sendResponse({ status, data: json });
        break;
      }
      // sidepanel : qualification de la réponse à froid, puis — sur validation
      // explicite (record: true) — inscription au CRM. Idempotent par
      // (prospect, jour Paris) : une double validation ne compte pas deux
      // réponses, ce qui gonflerait les KPI d'accroche.
      // sidepanel : pose un stade — proposé par l'IA (« Recaler ») ou choisi à
      // la main. Message DISTINCT de `ig:classify` : `if (msg.record)` y était
      // vrai pour `record: "stage"`, donc le recalage passait par la dedup des
      // RÉPONSES (avalé sans bruit si une réponse était déjà journalisée ce
      // jour-là) puis postait `record: true` en dur, sans transmettre le stade.
      // Le bouton « Recaler » n'a donc jamais recalé quoi que ce soit.
      // sidepanel : « Refus ». Geste composite côté app (réponse du jour
      // reclassée + sortie du pipeline), donc un seul aller-retour ici. PAS de
      // dedup locale : reclasser un `neutre` en `refus` est justement ce que
      // la dedup des réponses empêchait.
      case "ig:refus": {
        const { status, json } = await api("/api/instagram/classify-reply", {
          method: "POST",
          body: JSON.stringify({
            username: msg.username,
            record: "refus",
            account_id: msg.accountId ?? null,
            excerpt: msg.excerpt ?? null,
          }),
        });
        sendResponse({ status, data: json });
        break;
      }
      case "ig:set-stage": {
        const { status, json } = await api("/api/instagram/classify-reply", {
          method: "POST",
          body: JSON.stringify({ username: msg.username, record: "stage", stage: msg.stage }),
        });
        sendResponse({ status, data: json });
        break;
      }
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
        await advanceAssist(armed, result);
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
        const texte = msg.text ?? "";
        const hit = NMFUtil.matchStep(texte, payload.steps ?? []);
        // Repli sur l'étape ATTENDUE quand le message ne ressemble à aucune
        // étape. C'est le cas ordinaire, pas l'exception : répondre à « c'est à
        // dire ? » s'écrit à la main. Exiger la ressemblance revenait à ne rien
        // journaliser dès que la conversation démarrait vraiment — 584 accroches
        // pour 38 suites inscrites, alors que 56 prospects avaient répondu.
        //
        // Le repli n'invente pas l'étape : `nextStep` est celle que le stade du
        // prospect appelle, donc celle que Nicolas est en train d'envoyer. Et
        // l'unicité en base (migration 027) absorbe le fil découpé en trois
        // bulles — trois détections, une seule ligne.
        const libre = !hit && NMFUtil.estMessageLibre(texte);
        const step = hit?.step ?? (libre ? payload.nextStep : null);
        if (!step) { sendResponse({ ok: false, reason: hit ? "no-step" : "no-match" }); break; }
        const accountId = await currentAccountId(payload);
        if (!accountId) { sendResponse({ ok: false, reason: "no-account" }); break; }
        // La variante n'accompagne QUE l'accroche réellement tirée du script :
        // un message libre ne doit pas créditer un bras du bandit.
        const result = await logSend({ prospectId, accountId, step, variant: hit ? payload.variantId ?? null : null });
        await chrome.storage.session.remove("cachedTrame"); // le stade a bougé
        broadcast({ type: "ig:logged", ...result, auto: step, libre });
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
        const hit = NMFUtil.incomingReply(msg.rows ?? [], steps);
        if (!hit) { sendResponse({ ok: false, reason: "no-incoming" }); break; }

        // Le fil ne porte AUCUNE date : journaliser au jour où on le lit n'est
        // exact que si la réponse est fraîche. Quand Nicolas a déjà répondu
        // (`last === false`), on ne l'inscrit que si ce prospect n'a jamais
        // répondu au CRM — c'est la donnée manquante, et sa 1re réponse est
        // celle qui compte (réponse à froid, comptée une fois). Pour un
        // prospect déjà journalisé, on s'abstient plutôt que de dater à
        // l'aveugle une réponse peut-être vieille de trois semaines.
        if (!hit.last && (payload.prospect?.reply_count ?? 0) > 0) {
          sendResponse({ ok: false, reason: "deja-repondu" });
          break;
        }

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
      // sidepanel : cadence d'envoi (métronome de chauffe).
      case "ig:pace": {
        const { paceStamps = [] } = await chrome.storage.local.get("paceStamps");
        sendResponse(NMFUtil.paceState(paceStamps, Date.now()));
        break;
      }
      // sidepanel : rapport concurrentiel. Long (scrape Maps) — le panneau
      // affiche un état d'attente explicite pendant ce temps.
      case "ig:competitors": {
        const { status, json } = await api("/api/instagram/competitors", {
          method: "POST",
          body: JSON.stringify({ username: msg.username, refresh: msg.refresh === true }),
        });
        // Le fait vient d'être écrit sur le prospect : la trame en cache
        // porte encore l'ancien (ou aucun).
        if (status === 200) await chrome.storage.session.remove("cachedTrame");
        sendResponse({ status, data: json });
        break;
      }
      // sidepanel : sparring — l'IA joue le prospect. Aucune écriture.
      case "ig:spar": {
        const { status, json } = await api("/api/instagram/spar", {
          method: "POST",
          body: JSON.stringify({
            metier: msg.metier ?? "", ville: msg.ville ?? "", step: msg.step ?? null,
            stepText: msg.stepText ?? null, history: msg.history ?? "", message: msg.message ?? "",
          }),
        });
        sendResponse({ status, data: json });
        break;
      }
      // sidepanel : accroche vivante — M1 réécrit autour de ce que sa page montre.
      case "ig:hook": {
        const { status, json } = await api("/api/instagram/hook", {
          method: "POST",
          body: JSON.stringify({
            username: msg.username, bio: msg.bio ?? "", posts: msg.posts ?? [], trame: msg.trame ?? null,
          }),
        });
        sendResponse({ status, data: json });
        break;
      }
      // sidepanel : mode chasse — capture le profil affiché en prospect scoré.
      case "ig:capture": {
        const { status, json } = await api("/api/instagram/capture", {
          method: "POST",
          body: JSON.stringify({ username: msg.username, ville: msg.ville ?? "" }),
        });
        // Le prospect existe désormais : la trame en cache dit encore
        // « hors base », elle doit être rejouée.
        if (status === 200) await chrome.storage.session.remove("cachedTrame");
        sendResponse({ status, data: json });
        break;
      }
      // sidepanel : la journée en chiffres (carte de clôture). Agrégé, aucun
      // pseudo — c'est ce qui permet à l'extension d'y avoir accès.
      case "ig:session": {
        const { status, json } = await api("/api/instagram/session");
        sendResponse({ status, data: json });
        break;
      }
      // sidepanel : file de prospection du jour (lecture seule).
      case "ig:queue": {
        // `noSite` : la bascule du panneau. Elle ne fait que filtrer la journee
        // deja composee — jamais chercher hors selection.
        const { status, json } = await api(`/api/instagram/queue${msg.noSite ? "?noSite=1" : ""}`);
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
