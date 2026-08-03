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
};

const STAGE_LABEL = {
  accroche: "Accroche envoyée", presentation: "Présentation", connexion: "Connexion",
  douleur: "Douleur", appel_propose: "Appel proposé", questionnaire_envoye: "Questionnaire envoyé",
  call_booke: "Call booké ✓", perdu: "Perdu",
};

async function refresh(username) {
  const r = await chrome.runtime.sendMessage({ type: "ig:get-trame", username });
  if (!r || r.status === 0) { $("error").textContent = r?.data?.error || "Extension non configurée."; return; }
  if (r.status === 401) { $("error").textContent = "401 — EXT_TOKEN invalide (options de l'extension / .env de l'app)."; return; }
  if (r.status !== 200) { $("error").textContent = r.data?.error || `Erreur ${r.status}`; return; }
  $("error").textContent = "";
  state.username = username ?? r.context?.username ?? null;
  state.igAccount = r.context?.account ?? state.igAccount;
  state.data = r.data;
  // § 8 : compte émetteur DÉTECTÉ — apparié par pseudo, sinon choix explicite.
  const match = r.data.accounts.find((a) => a.username === state.igAccount);
  state.accountId = match ? match.id : null;
  render();
}

function render() {
  const { data, username } = state;
  if (!data) return;
  const p = data.prospect;
  $("title").textContent = p ? `@${p.username}` : username ? `@${username} (hors base)` : "Trame générique";
  $("sub").textContent = p
    ? `${STAGE_LABEL[p.stage] ?? "Jamais contacté"} · ${p.metier ?? "métier ?"} · ${p.ville ?? "ville ?"}`
    : username
      ? "Compte inconnu de la base — trame générique, rien ne sera journalisé."
      : "Aucune conversation détectée — trame générique.";
  renderAccount();
  renderSteps();
}

function renderAccount() {
  const { data, igAccount, accountId } = state;
  const el = $("account");
  const match = data.accounts.find((a) => a.id === accountId);
  if (match) {
    const full = !match.canSend;
    el.innerHTML = `<div class="${full ? "warn" : "muted"}">Émetteur : @${esc(match.username)} — ${match.sentDay}/${match.daily} aujourd'hui${full ? " · PLAFOND : la journalisation sera refusée (429)" : ""}</div>`;
    return;
  }
  // Aucun match : choix explicite obligatoire (§ 8 — jamais deviné).
  el.innerHTML = `<div class="warn">Compte connecté${igAccount ? ` @${esc(igAccount)}` : ""} non déclaré dans l'app — choisis l'émetteur :</div>
    <select id="accountSelect"><option value="">— choisir —</option>
    ${data.accounts.map((a) => `<option value="${a.id}">@${esc(a.username)} (${a.sentDay}/${a.daily})</option>`).join("")}</select>`;
  $("accountSelect").addEventListener("change", (e) => { state.accountId = e.target.value || null; render(); });
}

function renderSteps() {
  const { data, accountId } = state;
  const p = data.prospect;
  $("steps").innerHTML = data.steps.map((s) => {
    const isNext = s.step === data.nextStep;
    const relance = s.step.startsWith("R");
    return `<div class="step ${isNext ? "next" : ""} ${relance ? "relance" : ""}">
      <div class="head"><span class="tag">${esc(s.step)} · ${esc(s.title)}</span>${isNext ? '<span class="now">à envoyer</span>' : ""}</div>
      <p>${esc(s.text)}</p>
      <button data-copy="${esc(s.step)}">Copier</button>
      ${p ? `<button class="primary" data-insert="${esc(s.step)}" ${accountId ? "" : 'title="Choisis un émetteur pour journaliser — l\'insertion reste possible"'}>Insérer</button>` : ""}
    </div>`;
  }).join("");

  for (const b of document.querySelectorAll("[data-copy]")) {
    b.addEventListener("click", () => {
      const s = data.steps.find((x) => x.step === b.dataset.copy);
      navigator.clipboard.writeText(s.text);
      b.textContent = "Copié ✓"; setTimeout(() => (b.textContent = "Copier"), 1200);
    });
  }
  for (const b of document.querySelectorAll("[data-insert]")) {
    b.addEventListener("click", () => insert(b.dataset.insert));
  }
}

async function insert(step) {
  const { data, accountId } = state;
  const p = data.prospect;
  const s = data.steps.find((x) => x.step === step);
  if (!p || !s) return;
  // Sans émetteur : on insère quand même (copier-coller assisté), mais on
  // n'arme PAS la journalisation — § 8, jamais deviné. Insertion directe via
  // content.js : garantie structurelle que rien ne peut être journalisé.
  if (!accountId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "ig:insert", text: s.text }).catch(() => {});
    $("error").textContent = "Inséré SANS journalisation (aucun émetteur choisi).";
    return;
  }
  const r = await chrome.runtime.sendMessage({ type: "ig:arm", prospectId: p.id, accountId, step, text: s.text });
  if (!r?.ok) {
    $("error").textContent = r?.reason === "no-composer"
      ? "Champ de message introuvable — ouvre la conversation, ou copie-colle."
      : "Onglet Instagram introuvable.";
    return;
  }
  $("error").textContent = "";
  state.lastArm = { prospectId: p.id, accountId, step };
  // Filet § 7 : si aucun ig:logged sous 5 s après l'envoi supposé, bouton manuel.
  clearTimeout(state.fallbackTimer);
  state.fallbackTimer = setTimeout(() => { $("fallback").style.display = "block"; }, 5000);
}

$("manualSent").addEventListener("click", async () => {
  if (!state.lastArm) return;
  const r = await chrome.runtime.sendMessage({ type: "ig:sent-manual", ...state.lastArm });
  if (r?.ok) { $("fallback").style.display = "none"; refresh(state.username); }
  else $("error").textContent = r?.error || "Journalisation refusée.";
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "ig:prospect-changed") {
    $("fallback").style.display = "none";
    clearTimeout(state.fallbackTimer);
    state.igAccount = msg.account ?? state.igAccount;
    refresh(msg.username);
  }
  if (msg?.type === "ig:logged") {
    clearTimeout(state.fallbackTimer);
    $("fallback").style.display = "none";
    if (msg.ok) refresh(state.username); // stade avancé → nextStep suivant surligné
    else { $("error").textContent = msg.error || "Journalisation refusée."; $("fallback").style.display = "block"; }
  }
});

// Au montage : demande un re-scan au content script puis charge le contexte.
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "ig:rescan" }).catch(() => {});
  refresh(null);
})();
