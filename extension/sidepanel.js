// extension/sidepanel.js
// UI de la trame. État minimal : la trame affichée + l'armement local (pour
// le filet manuel). Le vrai état (quota, stade) vit dans l'app — on refetch.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

let state = {
  username: null,      // pseudo affiché sur instagram.com
  igAccount: null,     // pseudo du compte Instagram connecté (détecté)
  data: null,          // { prospect, steps, nextStep, accounts }
  accountId: null,     // compte émetteur retenu pour journaliser
  lastArm: null,       // { prospectId, accountId, step } — filet manuel
  fallbackTimer: null,
  showAll: false,      // trame complète dépliée
  aiBusy: false,
  manual: null,        // pseudo saisi à la main (détection en échec)
};

/**
 * Tout message vers la page passe par le service worker : lui seul peut
 * garantir que les content scripts y tournent encore (ils sont orphelinés à
 * chaque rechargement de l'extension).
 */
const toTab = (payload) => chrome.runtime.sendMessage({ type: "ig:tab", payload }).catch(() => null);

/** Traduit un échec du pont en phrase qui dit quoi faire. */
function tabError(r) {
  switch (r?.reason) {
    case "not-instagram": return "Mets l'onglet Instagram au premier plan.";
    case "no-tab": return "Aucun onglet actif.";
    case "no-content-script": return "Extension pas encore active sur cette page — recharge l'onglet Instagram (F5).";
    case "no-composer": return "Champ de message introuvable — ouvre la conversation.";
    case "insert-failed": return "Instagram a refusé l'écriture dans le champ — copie le texte ci-dessous.";
    default: return "Action impossible sur cette page.";
  }
}

const STAGE_LABEL = {
  accroche: "Accroche envoyée", presentation: "Présentation", connexion: "Connexion",
  douleur: "Douleur", appel_propose: "Appel proposé", questionnaire_envoye: "Questionnaire envoyé",
  call_booke: "Call booké ✓", perdu: "Perdu",
};

async function refresh(username, detectedAccount) {
  const r = await chrome.runtime.sendMessage({ type: "ig:get-trame", username });
  if (!r || r.status === 0) { $("error").textContent = r?.data?.error || "Extension non configurée."; return; }
  if (r.status === 401) { $("error").textContent = "401 — EXT_TOKEN invalide (options de l'extension / .env de l'app)."; return; }
  if (r.status !== 200) { $("error").textContent = r.data?.error || `Erreur ${r.status}`; return; }
  $("error").textContent = "";
  state.username = username ?? r.context?.username ?? null;
  state.data = r.data;
  const accounts = r.data.accounts ?? [];
  // m1 : le compte détecté DOIT transiter par les paramètres de refresh — pas
  // par une mutation de state.igAccount faite par l'appelant AVANT refresh(),
  // sinon prevDetected/nextDetected sont identiques par construction et le
  // choix manuel n'est plus jamais réévalué (régression : DM journalisé sur
  // le mauvais émetteur si le compte Instagram connecté change réellement).
  const prevDetected = state.igAccount;
  const nextDetected = detectedAccount ?? r.context?.account ?? prevDetected;
  // Ne jamais écraser un choix manuel silencieusement — on ne recalcule
  // l'appariement que si le compte détecté a changé ou si l'émetteur choisi
  // n'existe plus (ex. supprimé côté app).
  const accountStillValid = state.accountId && accounts.some((a) => a.id === state.accountId);
  const detectedUnchanged = nextDetected === prevDetected;
  if (!(state.accountId && detectedUnchanged && accountStillValid)) {
    // § 8 : un seul compte déclaré → c'est lui ; plusieurs → apparié par
    // pseudo détecté, sinon choix explicite (jamais deviné).
    state.accountId = NMFUtil.pickAccountId(accounts, nextDetected);
  }
  state.igAccount = nextDetected;
  render();
}

function render() {
  const { data, username } = state;
  if (!data) return;
  const p = data.prospect;
  $("title").textContent = p ? `@${p.username}` : username ? `@${username}` : "Trame DM";
  const stage = $("stage");
  if (p) {
    stage.hidden = false;
    stage.textContent = STAGE_LABEL[p.stage] ?? "Jamais contacté";
  } else {
    stage.hidden = true;
  }
  $("sub").textContent = p
    ? [p.metier || "métier ?", p.ville || "ville ?", p.followers ? `${p.followers} abonnés` : null].filter(Boolean).join(" · ")
    : username
      ? "Hors base — trame générique, rien ne sera journalisé."
      : "Aucune conversation détectée — trame générique.";
  // Saisie manuelle : le seul recours quand Instagram change son DOM. Tant
  // qu'aucun prospect n'est chargé, la trame est générique et rien n'est
  // journalisable — autant pouvoir le débloquer soi-même.
  $("manual").hidden = !!p;
  renderAccount();
  renderTrame();
}

function renderAccount() {
  const { data, igAccount, accountId } = state;
  const el = $("account");
  const accounts = data.accounts ?? [];
  const match = accounts.find((a) => a.id === accountId);

  if (match) {
    // Un seul émetteur (le cas normal) : une ligne d'info, aucun choix à faire.
    // Le dépassement de plafond n'est plus un blocage — c'est une info : un DM
    // parti à la main est journalisé quoi qu'il arrive.
    const over = match.sentDay >= match.daily;
    el.className = over ? "warn" : "muted";
    el.textContent = `@${match.username} · ${match.sentDay}/${match.daily} aujourd'hui${over ? " · au-dessus du plafond (journalisé quand même)" : ""}`;
    return;
  }
  if (!accounts.length) {
    el.className = "warn";
    el.textContent = "Aucun compte émetteur déclaré dans l'app — rien ne pourra être journalisé.";
    return;
  }
  // Plusieurs comptes et aucun apparié : choix explicite obligatoire (§ 8).
  el.className = "";
  el.innerHTML = `<div class="warn">Compte connecté${igAccount ? ` @${esc(igAccount)}` : ""} non reconnu — choisis l'émetteur :</div>
    <select id="accountSelect"><option value="">— choisir —</option>
    ${accounts.map((a) => `<option value="${esc(a.id)}">@${esc(a.username)} (${esc(a.sentDay)}/${esc(a.daily)})</option>`).join("")}</select>`;
  $("accountSelect").addEventListener("change", (e) => { state.accountId = e.target.value || null; render(); });
}

/** Carte d'une étape de la séquence. */
function stepCard(s, isNext, canInsert) {
  const relance = s.step.startsWith("R");
  return `<div class="step ${isNext ? "next" : ""} ${relance ? "relance" : ""}">
    <div class="head"><span class="tag">${esc(s.step)} · ${esc(s.title)}</span>${isNext ? '<span class="now">à envoyer</span>' : ""}</div>
    <p>${esc(s.text)}</p>
    <div class="row">
      <button data-copy="${esc(s.step)}">Copier</button>
      ${canInsert ? `<button class="primary" data-insert="${esc(s.step)}">Insérer</button>` : ""}
    </div>
  </div>`;
}

function renderTrame() {
  const { data } = state;
  const next = data.steps.find((s) => s.step === data.nextStep);
  // L'insertion est toujours proposée : écrire dans le champ ne dépend pas de
  // la présence du prospect en base — seule la JOURNALISATION en dépend.
  $("next").innerHTML = next
    ? stepCard(next, true, true)
    : `<div class="muted">Séquence terminée pour ce prospect — plus rien à envoyer depuis la trame.</div>`;

  const others = data.steps.filter((s) => s.step !== data.nextStep);
  $("steps").innerHTML = others.map((s) => stepCard(s, false, true)).join("");
  $("steps").hidden = !state.showAll;
  $("moreToggle").textContent = state.showAll ? "Masquer la trame" : `Voir toute la trame (${others.length})`;

  bindStepButtons();
}

function bindStepButtons() {
  for (const b of document.querySelectorAll("[data-copy]")) {
    b.addEventListener("click", () => {
      const s = state.data.steps.find((x) => x.step === b.dataset.copy);
      navigator.clipboard.writeText(s.text);
      b.textContent = "Copié ✓"; setTimeout(() => (b.textContent = "Copier"), 1200);
    });
  }
  for (const b of document.querySelectorAll("[data-insert]")) {
    b.addEventListener("click", () => insert(b.dataset.insert));
  }
}

/**
 * Insertion NON journalisable (réponse IA, ou trame sans émetteur connu).
 * Désarme d'abord : un armement laissé par une insertion précédente ferait
 * journaliser l'ANCIENNE étape au moment où ce message-ci partirait.
 */
async function insertRaw(text) {
  await chrome.runtime.sendMessage({ type: "ig:disarm" }).catch(() => {});
  state.lastArm = null;
  clearTimeout(state.fallbackTimer);
  $("fallback").style.display = "none";
  return await toTab({ type: "ig:insert", text });
}

async function insert(step) {
  const { data, accountId } = state;
  const p = data.prospect;
  const s = data.steps.find((x) => x.step === step);
  if (!s) return;
  // Prospect hors base ou émetteur inconnu : on insère quand même (le texte
  // reste utile), mais on n'arme PAS la journalisation — rien à journaliser
  // contre un prospect inexistant, et § 8 : l'émetteur n'est jamais deviné.
  if (!p || !accountId) {
    await insertRaw(s.text);
    $("error").textContent = p
      ? "Inséré SANS journalisation (aucun émetteur retenu)."
      : "Inséré SANS journalisation (prospect hors base).";
    return;
  }
  const r = await chrome.runtime.sendMessage({ type: "ig:arm", prospectId: p.id, accountId, step, text: s.text });
  if (!r?.ok) { $("error").textContent = tabError(r); return; }
  $("error").textContent = "";
  state.lastArm = { prospectId: p.id, accountId, step };
  // Filet § 7 : si aucun ig:logged sous 30 s après l'insertion, bouton manuel.
  // Délai généreux : un délai court faisait apparaître le bouton « Envoyé »
  // pendant la simple relecture du message, avant même qu'il soit parti,
  // ce qui invitait à journaliser un message pas encore envoyé.
  clearTimeout(state.fallbackTimer);
  state.fallbackTimer = setTimeout(() => { $("fallback").style.display = "block"; }, 30000);
}

// ── Réponse IA (hors trame) ────────────────────────────────────────────────
// Aide à la rédaction uniquement : une réponse IA n'est pas une étape de la
// séquence, donc elle n'est jamais journalisée et ne fait pas bouger le stade.

/** Relit le fil affiché et le met en texte éditable (« moi: » / « lui: »). */
async function grabThread() {
  const r = await toTab({ type: "ig:thread", username: state.username });
  if (!r || r.reason) { $("error").textContent = tabError(r); return; }
  const rows = r.rows ?? [];
  if (!rows.length) {
    // Ne jamais échouer sans le dire : c'est ce silence qui laissait croire
    // que « relire le fil » ne faisait rien.
    $("error").textContent = "Fil illisible sur cette page — ouvre la conversation, ou colle-le à la main.";
    return;
  }
  // Les messages de la trame sont, par construction, ceux de Nicolas : ils
  // lèvent l'ambiguïté sur les lignes qu'Instagram n'étiquette pas.
  const sent = (state.data?.steps ?? []).map((s) => s.text);
  $("aiIncoming").value = NMFUtil.formatThread(rows, sent);
  const unknown = rows.filter((x) => x.from !== "moi" && x.from !== "lui").length;
  $("aiHint").textContent = unknown
    ? `${unknown} ligne(s) « ?: » — corrige en « moi: » ou « lui: » avant de générer.`
    : "";
}

$("aiToggle").addEventListener("click", async () => {
  const body = $("aiBody");
  body.hidden = !body.hidden;
  $("aiToggle").textContent = body.hidden ? "déplier" : "replier";
  if (!body.hidden && !$("aiIncoming").value.trim()) await grabThread();
});

$("aiGrab").addEventListener("click", grabThread);

$("aiGen").addEventListener("click", async () => {
  if (state.aiBusy) return;
  const { incoming, history } = NMFUtil.splitThread($("aiIncoming").value);
  if (!incoming) { $("error").textContent = "Colle son message (ou le fil) d'abord."; return; }
  state.aiBusy = true;
  $("aiGen").disabled = true;
  $("aiGen").textContent = "Génération…";
  $("aiOut").innerHTML = "";
  try {
    const r = await chrome.runtime.sendMessage({ type: "ig:ai-reply", username: state.username, incoming, history });
    if (r?.status !== 200) {
      $("error").textContent = r?.data?.error || `Erreur ${r?.status ?? 0}`;
      return;
    }
    $("error").textContent = "";
    const list = r.data.suggestions ?? [];
    $("aiOut").innerHTML = list
      .map((s, i) => `<div class="sugg">
          <div class="tag">${esc(s.label)}</div>
          <p>${esc(s.text)}</p>
          <div class="row">
            <button data-ai-copy="${i}">Copier</button>
            <button class="primary" data-ai-insert="${i}">Insérer</button>
          </div>
        </div>`)
      .join("");
    for (const b of $("aiOut").querySelectorAll("[data-ai-copy]")) {
      b.addEventListener("click", () => {
        navigator.clipboard.writeText(list[Number(b.dataset.aiCopy)].text);
        b.textContent = "Copié ✓"; setTimeout(() => (b.textContent = "Copier"), 1200);
      });
    }
    for (const b of $("aiOut").querySelectorAll("[data-ai-insert]")) {
      b.addEventListener("click", async () => {
        const res = await insertRaw(list[Number(b.dataset.aiInsert)].text);
        $("error").textContent = res?.ok
          ? "Inséré — hors trame, non journalisé."
          : "Champ de message introuvable — ouvre la conversation, ou copie-colle.";
      });
    }
  } finally {
    state.aiBusy = false;
    $("aiGen").disabled = false;
    $("aiGen").textContent = "Générer 3 réponses";
  }
});

$("moreToggle").addEventListener("click", () => {
  state.showAll = !state.showAll;
  renderTrame();
});

/** Affiche le texte corrigé dans le panneau : à relire, à copier, à réinsérer. */
function showCorrection(text) {
  $("fixOut").innerHTML = `<div class="sugg">
      <div class="tag">Corrigé</div>
      <p>${esc(text)}</p>
      <div class="row">
        <button id="fixCopy">Copier</button>
        <button class="primary" id="fixInsert">Réinsérer</button>
      </div>
    </div>`;
  $("fixCopy").addEventListener("click", (e) => {
    navigator.clipboard.writeText(text);
    e.target.textContent = "Copié ✓";
    setTimeout(() => (e.target.textContent = "Copier"), 1200);
  });
  $("fixInsert").addEventListener("click", async () => {
    // Réinsertion du MÊME message corrigé : l'armement doit survivre.
    const r = await toTab({ type: "ig:insert", text });
    $("error").textContent = r?.ok ? "Réinséré ✓" : tabError(r);
  });
}

/**
 * Corrige l'orthographe du texte présent dans le champ Instagram, en place.
 *
 * Réinsère SANS passer par insertRaw : c'est le même message, corrigé — s'il
 * était armé pour la journalisation, il doit le rester. Désarmer ici ferait
 * perdre l'étape au moment de l'envoi.
 */
$("fixSpell").addEventListener("click", async () => {
  const btn = $("fixSpell");
  if (btn.disabled) return;
  const c = await toTab({ type: "ig:composer-text" });
  if (!c || c.reason) { $("error").textContent = tabError(c); return; }
  const text = (c.text ?? "").trim();
  if (!text) {
    $("error").textContent = c.text === null
      ? "Champ de message introuvable — ouvre la conversation."
      : "Le champ est vide — tape ton message d'abord.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Correction…";
  try {
    const r = await chrome.runtime.sendMessage({ type: "ig:proofread", text });
    if (r?.status !== 200) { $("error").textContent = r?.data?.error || `Erreur ${r?.status ?? 0}`; return; }
    if (!r.data.changed) { $("fixOut").innerHTML = ""; $("error").textContent = "Rien à corriger."; return; }
    // La correction est TOUJOURS affichée dans le panneau, même quand
    // l'insertion réussit : c'est le seul moyen de voir ce qui a changé, et
    // le seul recours si Instagram refuse l'écriture.
    const ins = await toTab({ type: "ig:insert", text: r.data.text });
    showCorrection(r.data.text);
    $("error").textContent = ins?.ok ? "Corrigé ✓ — relis avant d'envoyer." : tabError(ins);
  } finally {
    btn.disabled = false;
    btn.textContent = "Corriger l'orthographe du champ";
  }
});

// ── Qualification de la réponse à froid ────────────────────────────────────
// Le modèle PROPOSE, Nicolas VALIDE. Une qualification écrite d'office
// sortirait le prospect de la file de relance et fausserait les KPI
// d'accroche sur une simple erreur de lecture.

const KIND_LABEL = { positive: "Positive", neutre: "Neutre", refus: "Refus", autorepondeur: "Autorépondeur" };

$("qualify").addEventListener("click", async () => {
  const btn = $("qualify");
  if (btn.disabled) return;
  if (!state.data?.prospect) { $("error").textContent = "Prospect hors base — rien à qualifier."; return; }
  // Le fil est la matière première : on le relit si le bloc IA est vide.
  if (!$("aiIncoming").value.trim()) await grabThread();
  const history = $("aiIncoming").value.trim();
  if (!history) { $("error").textContent = "Fil de conversation illisible — déplie « Réponse IA » et colle-le."; return; }

  btn.disabled = true;
  btn.textContent = "Analyse…";
  try {
    const r = await chrome.runtime.sendMessage({ type: "ig:classify", username: state.username, history });
    if (r?.status !== 200) { $("error").textContent = r?.data?.error || `Erreur ${r?.status ?? 0}`; return; }
    $("error").textContent = "";
    showVerdict(r.data.verdict);
  } finally {
    btn.disabled = false;
    btn.textContent = "Qualifier la réponse";
  }
});

function showVerdict(v) {
  if (!v?.replied || !v.kind) {
    $("qualifyOut").innerHTML = `<div class="sugg doubt"><div class="tag">Aucune réponse</div>
      <p>${esc(v?.reason || "Le prospect n'a pas encore répondu.")}</p></div>`;
    return;
  }
  const doubt = v.confidence !== "haute";
  $("qualifyOut").innerHTML = `<div class="sugg verdict ${doubt ? "doubt" : ""}">
      <div class="tag">${esc(KIND_LABEL[v.kind] ?? v.kind)}${v.cold ? " · à froid" : ""} · confiance ${esc(v.confidence)}</div>
      <p>${esc(v.excerpt || "—")}</p>
      <div class="muted">${esc(v.reason)}</div>
      <div class="row">
        <select id="kindPick">${Object.entries(KIND_LABEL)
          .map(([k, l]) => `<option value="${esc(k)}"${k === v.kind ? " selected" : ""}>${esc(l)}</option>`)
          .join("")}</select>
      </div>
      <div class="row"><button class="primary" id="recordReply">Enregistrer dans le CRM</button></div>
    </div>`;

  $("recordReply").addEventListener("click", async () => {
    const btn = $("recordReply");
    btn.disabled = true;
    btn.textContent = "Enregistrement…";
    const r = await chrome.runtime.sendMessage({
      type: "ig:classify",
      record: true,
      username: state.username,
      kind: $("kindPick").value,
      excerpt: v.excerpt,
      accountId: state.accountId,
    });
    if (r?.status === 200 && r.data?.ok) {
      $("qualifyOut").innerHTML = `<div class="sugg verdict"><div class="tag">Enregistré ✓</div>
        <p class="muted">${r.data.deduped ? "Déjà enregistré aujourd'hui — rien de compté en double." : "Réponse inscrite au CRM ; le prospect sort de la file de relance."}</p></div>`;
      refresh(state.username);
    } else {
      $("error").textContent = r?.data?.error || "Enregistrement refusé.";
      btn.disabled = false;
      btn.textContent = "Enregistrer dans le CRM";
    }
  });
}

async function loadManual() {
  const u = $("manualUser").value.replace(/^@/, "").trim().toLowerCase();
  if (!u) return;
  state.manual = u;
  await refresh(u);
}
$("manualLoad").addEventListener("click", loadManual);
$("manualUser").addEventListener("keydown", (e) => { if (e.key === "Enter") loadManual(); });

$("manualSent").addEventListener("click", async () => {
  if (!state.lastArm) return;
  const r = await chrome.runtime.sendMessage({ type: "ig:sent-manual", ...state.lastArm });
  if (r?.ok) { $("fallback").style.display = "none"; refresh(state.username); }
  else $("error").textContent = r?.error || "Journalisation refusée.";
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "ig:prospect-changed") {
    // Détection toujours en échec : ne pas écraser la saisie manuelle par un
    // « rien détecté » à chaque re-scan de la SPA.
    if (!msg.username && state.manual) return;
    state.manual = null;
    $("fallback").style.display = "none";
    clearTimeout(state.fallbackTimer);
    // Nouvelle conversation : ce qui restait du bloc IA ne la concerne pas.
    $("aiIncoming").value = "";
    $("aiOut").innerHTML = "";
    $("aiHint").textContent = "";
    $("fixOut").innerHTML = "";
    $("qualifyOut").innerHTML = "";
    refresh(msg.username, msg.account);
  }
  if (msg?.type === "ig:logged") {
    clearTimeout(state.fallbackTimer);
    $("fallback").style.display = "none";
    if (msg.ok) refresh(state.username); // stade avancé → nextStep suivant surligné
    else { $("error").textContent = msg.error || "Journalisation refusée."; $("fallback").style.display = "block"; }
  }
});

// Au montage : re-scan de la page (les content scripts sont ré-injectés si le
// rechargement de l'extension les a orphelinés), puis chargement du contexte.
(async () => {
  const r = await toTab({ type: "ig:rescan" });
  if (r?.reason && r.reason !== "not-instagram") $("error").textContent = tabError(r);
  refresh(null);
  // Laisse au content script fraîchement injecté le temps d'annoncer le
  // prospect : à la première passe, le contexte est encore vide.
  setTimeout(() => { if (!state.manual) refresh(null); }, 600);
})();
