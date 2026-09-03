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
  aiBusy: false,
  retoneBusy: false,
  manual: null,        // pseudo saisi à la main (détection en échec)
  trame: null,         // trame CHOISIE ici ; null = laisse l'app décider
  queueNoSite: false,  // « Suivant » ne sert que des profils sans site
  assistMode: false,   // après Entrée : ouvre le suivant et prépare son M1
};

/**
 * Trame retenue pour ce pseudo, mémorisée localement.
 *
 * Ne sert qu'AVANT le premier message : dès qu'une étape est partie, l'app
 * déduit la trame du journal d'envois — ce qui a réellement été envoyé est la
 * seule source qui survit à un autre poste ou à un storage vidé. Ce cache ne
 * fait que porter le choix jusque-là.
 */
const TRAME_MEMORY_MAX = 400;

async function trameChoiceFor(username) {
  if (!username) return null;
  const { trameChoice = {} } = await chrome.storage.local.get("trameChoice");
  return trameChoice[username] ?? null;
}

async function rememberTrame(username, trame) {
  if (!username) return;
  const { trameChoice = {} } = await chrome.storage.local.get("trameChoice");
  delete trameChoice[username]; // ré-insère en fin : l'ordre des clés est l'ordre d'usage
  trameChoice[username] = trame;
  const keys = Object.keys(trameChoice);
  for (const old of keys.slice(0, Math.max(0, keys.length - TRAME_MEMORY_MAX))) delete trameChoice[old];
  await chrome.storage.local.set({ trameChoice });
}

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
  accroche: "Accroche envoyée", receptif: "Réceptif", presentation: "Présentation", connexion: "Connexion",
  douleur: "Douleur", appel_propose: "Appel proposé", questionnaire_envoye: "Questionnaire envoyé",
  call_booke: "Call booké ✓", perdu: "Perdu",
};

/**
 * Les trois stades qu'on pose EN LISANT le fil, sans rien envoyer — donc les
 * seuls qui méritent un bouton. Le reste du pipeline se déduit de ce qui part
 * et reste dans le sélecteur.
 */
const STAGE_PICKS = [
  { stage: "receptif", label: "Réceptif", title: "Il a répondu — la conversation est vivante" },
  { stage: "call_booke", label: "Booké", title: "Appel calé : statut positif, relances coupées" },
  // « Refus » n'est PAS un stade : c'est une réponse de genre `refus` qui vaut
  // aussi fin de conversation. Il touche les deux axes, d'où le mode à part.
  { mode: "refus", label: "Refus", title: "Il a dit non : réponse comptée en refus (colonne F) + sorti du pipeline", cls: "lost" },
  { stage: "perdu", label: "Perdu", title: "Injoignable, il n'a jamais parlé : sorti du pipeline, AUCUN refus compté", cls: "lost" },
];

async function refresh(username, detectedAccount) {
  // Le choix de trame accompagne la requête : c'est l'app qui rend la
  // partition, pas le panneau. Sans choix explicite, elle déduit du journal.
  if (state.trame === null) state.trame = await trameChoiceFor(username ?? state.username);
  const r = await chrome.runtime.sendMessage({ type: "ig:get-trame", username, trame: state.trame });
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
  stage.hidden = !p;
  if (p) stage.textContent = STAGE_LABEL[p.stage] ?? "jamais contacté";

  // A-t-il un site ? C'est ce qu'on vend, donc la question qui decide de la
  // trame armee — et la seule qu'on ne peut pas lire sur la page Instagram.
  // `null` = inconnu, compte comme sans site : meme regle que la selection du
  // jour (`estSansSite`). Sans ca, les deux se contrediraient a l'ecran.
  const flag = $("siteFlag");
  flag.hidden = !p;
  if (p) {
    const sansSite = p.has_website !== true;
    flag.className = sansSite ? "no" : "yes";
    flag.textContent = sansSite ? "sans site" : "a un site";
    flag.title = sansSite
      ? p.has_website === null
        ? "Aucun site connu (non renseigné) — traité comme sans site : trame Site par défaut."
        : "Pas de site — la cible : trame Site par défaut."
      : "Il a déjà un site — trame Standard par défaut.";
  }

  $("sub").textContent = p
    ? [p.metier || "métier ?", p.ville, p.followers ? `${p.followers} abonnés` : null].filter(Boolean).join(" · ")
    : username
      ? "Hors base — trame générique, rien ne sera journalisé."
      : "Aucune conversation détectée — trame générique.";
  // A-t-il déjà répondu, et depuis quand ? Sans cette ligne, une conversation
  // qu'on poursuit ressemble à une nouvelle réponse — et seule la PREMIÈRE
  // réponse d'un prospect compte comme réponse à froid.
  const rs = NMFUtil.replyState(p);
  const rsEl = $("replyState");
  rsEl.hidden = !rs;
  if (rs) {
    rsEl.className = rs.tone;
    rsEl.innerHTML = `<b>${esc(rs.text)}</b>${rs.detail ? `<i>${esc(rs.detail)}</i>` : ""}`;
  }

  // Saisie manuelle : le seul recours quand Instagram change son DOM. Tant
  // qu'aucun prospect n'est chargé, la trame est générique et rien n'est
  // journalisable — autant pouvoir le débloquer soi-même.
  $("manual").hidden = !!p;
  // Le profil est identifié mais absent de la base : c'est le seul cas où
  // capter a un sens. Sans pseudo, il n'y a rien à capter ; avec prospect,
  // c'est déjà fait.
  $("capture").hidden = !!p || !(username || state.manual);
  renderWarmup();
  renderFact();
  renderCompare();
  renderDemo();
  renderTrameSwitch();
  renderRail();
  renderAccount();
  renderTrame();
  renderStagePicker();
  // L'accroche vivante ne concerne que le premier message : au-delà, la
  // conversation a déjà commencé et il n'y a plus rien à personnaliser.
  const first = /^[MS]1$/.test(data.nextStep ?? "");
  $("hookWrap").hidden = !first;
  if (!first) $("hookOut").innerHTML = "";
}

// ── Métronome de chauffe ───────────────────────────────────────────────────
// À 50 DM/jour, ce n'est pas le total qui tue un compte, c'est la cadence :
// douze messages en quatre minutes ne ressemblent à rien d'humain. Le panneau
// FREINE — il n'interdit jamais. Bloquer l'insertion ferait retaper le message
// à la main, donc partir quand même, mais hors du compteur.

let paceTimer = null;

async function refreshPace() {
  const s = await chrome.runtime.sendMessage({ type: "ig:pace" }).catch(() => null);
  const el = $("pace");
  if (!s || (!s.wait && s.burst < 4)) {
    el.hidden = true;
    clearTimeout(paceTimer);
    paceTimer = null;
    return;
  }
  el.hidden = false;
  el.className = s.wait > 0 ? "hot" : "";
  el.innerHTML = s.wait > 0
    ? `<i class="dot"></i><span><b>${s.wait} s</b> — ${s.burst} envoi${s.burst > 1 ? "s" : ""} sur la dernière minute. Instagram compte les cadences.</span>`
    : `<i class="dot"></i><span>${s.burst} envois sur la dernière minute — laisse respirer.</span>`;
  // Un compte à rebours qui ne descend pas est pire que pas de compte à
  // rebours : on se demande s'il tourne encore.
  clearTimeout(paceTimer);
  paceTimer = setTimeout(refreshPace, 1000);
}

// ── Réchauffage passif ─────────────────────────────────────────────────────
// Un DM de relance dans un fil froid tombe dans les demandes. Une vue de story
// vingt minutes avant le remonte dans SA tête et dans l'algorithme. Le geste le
// plus rentable de la prospection Instagram n'est pas un message — et aucun
// outil ne le prescrit.
//
// L'extension ne clique JAMAIS sur Instagram : elle dit quoi faire, l'humain le
// fait. C'est la même règle que « elle n'envoie jamais ».

const WARMUP_GESTES = [
  "Ouvre son profil et regarde sa story.",
  "Like son dernier post — un seul, pas trois.",
];

async function warmupDone(username) {
  if (!username) return false;
  const { warmups = {} } = await chrome.storage.local.get("warmups");
  return warmups[username] === NMFUtil.parisDay(new Date());
}

async function markWarmup(username) {
  const { warmups = {} } = await chrome.storage.local.get("warmups");
  delete warmups[username];
  warmups[username] = NMFUtil.parisDay(new Date());
  const keys = Object.keys(warmups);
  for (const old of keys.slice(0, Math.max(0, keys.length - 400))) delete warmups[old];
  await chrome.storage.local.set({ warmups });
}

/** Une relance arrive : il a été contacté, il n'a jamais répondu. */
function warmupApplies(p) {
  if (!p || !p.stage || p.stage === "perdu" || p.stage === "call_booke") return false;
  if ((p.reply_count ?? 0) > 0) return false; // il parle : le fil est déjà chaud
  if (!p.last_dm_at) return false;
  const h = (Date.now() - Date.parse(p.last_dm_at)) / 3600000;
  return h >= 12; // pas le jour même : on ne réchauffe pas ce qu'on vient d'envoyer
}

async function renderWarmup() {
  const p = state.data?.prospect;
  const el = $("warmup");
  el.hidden = !warmupApplies(p);
  if (el.hidden) return;
  const done = await warmupDone(p.username);
  el.className = done ? "done" : "";
  el.innerHTML = `<div class="lead">Avant de relancer</div>
    <p>${esc(WARMUP_GESTES.join(" ")) }</p>
    ${done ? `<p class="muted" style="margin-top:6px">Fait aujourd'hui ✓</p>`
           : `<div class="row"><button class="quiet" id="warmupDone">C'est fait</button></div>`}`;
  if (!done) {
    $("warmupDone").addEventListener("click", async () => {
      await markWarmup(p.username);
      renderWarmup();
    });
  }
}

/**
 * Ce qu'il ne sait pas sur lui-même.
 *
 * L'app sait classer le prospect sur Google Maps et voir qui achète des Ads
 * sur sa requête. Cette information vivait dans le dashboard web — c'est-à-dire
 * NULLE PART au moment où on écrit le message. Sa trame vend un service ;
 * cette ligne-là vend un problème qu'il ignore.
 *
 * Au-delà de 90 jours le fait est grisé : un classement Google de six mois
 * n'est plus un fait, c'est un souvenir — et se faire corriger par le prospect
 * sur son propre métier coûte plus cher que se taire.
 */
const FACT_STALE_DAYS = 90;

function renderFact() {
  const f = state.data?.fact;
  const el = $("fact");
  el.hidden = !f;
  if (!f) return;
  const days = Math.floor((Date.now() - Date.parse(f.checkedAt)) / 86400000);
  const stale = !(days >= 0) || days > FACT_STALE_DAYS;
  el.className = stale ? "stale" : "";
  el.innerHTML = `<p>${esc(f.text)}</p>
    <div class="meta">
      <button class="quiet" id="factCopy">Copier</button>
      <span class="age">${stale ? `relevé il y a ${esc(days)} j — à revérifier` : `relevé ${esc(NMFUtil.sinceLabel(f.checkedAt))}`}</span>
    </div>`;
  $("factCopy").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(f.text);
      e.target.textContent = "Copié ✓";
      setTimeout(() => { e.target.textContent = "Copier"; }, 1200);
    } catch {
      $("error").textContent = "Copie refusée — clique dans le panneau puis réessaie.";
    }
  });
}

// ── La comparaison ─────────────────────────────────────────────────────────
// Le fait ci-dessus AFFIRME (« vous êtes 14e ») ; ce bloc MONTRE. Sans lui, on
// colle une phrase qu'on ne peut pas défendre si le prospect répond « ah bon,
// et qui est devant alors ? ».
//
// Le scrape Maps prend une à deux minutes : il n'est jamais lancé tout seul.
// C'est un geste, et le panneau le dit.

let compareRun = false;

const ADS_LABEL = { sponso: "Ads", tag: "Ads", non: "" };

function renderCompare() {
  const p = state.data?.prospect;
  const el = $("compare");
  if (!p) { el.innerHTML = ""; return; }
  // Déjà relevé : le bouton propose de REFAIRE, pas de faire. Sinon on
  // relance un scrape d'une minute sans le vouloir.
  const known = !!state.data?.fact;
  el.innerHTML = `<div class="run">
      <button class="quiet" id="compareRun" title="Classe ce prospect sur « métier ville » dans Google Maps et regarde qui paie des Ads (1-2 min)">
        ${known ? "Refaire le relevé" : "Le comparer à ses concurrents"}
      </button>
      <span class="muted" id="compareState"></span>
    </div>
    <div id="compareOut"></div>`;
  $("compareRun").addEventListener("click", () => runCompare(known));
  // Un relevé déjà en base n'affiche pas la liste : elle n'est pas stockée,
  // seul le fait l'est. Le dire évite de croire que le bouton n'a rien fait.
  $("compareOut").innerHTML = "";
}

async function runCompare(again) {
  if (compareRun) return;
  const p = state.data?.prospect;
  if (!p) return;
  if (!p.metier || !p.ville) {
    $("error").textContent = `Il manque ${!p.metier && !p.ville ? "le métier et la ville" : !p.metier ? "le métier" : "la ville"} sur ce prospect — impossible de le classer.`;
    return;
  }
  compareRun = true;
  $("compareRun").disabled = true;
  // Le scrape est long : un bouton qui ne dit rien pendant 90 s se lit comme
  // un bouton cassé, et on reclique.
  $("compareState").textContent = "scrape Google Maps… (1-2 min)";
  try {
    const r = await chrome.runtime.sendMessage({
      type: "ig:competitors", username: state.username, refresh: again === true,
    });
    if (r?.status !== 200) {
      $("error").textContent = r?.data?.error || `Erreur ${r?.status ?? 0}`;
      return;
    }
    $("error").textContent = "";
    // Le fait a bougé en base : on relit la trame pour que le bloc du dessus
    // se mette à jour tout seul. `render()` reconstruit #compareOut, donc la
    // liste s'affiche APRÈS, sinon elle serait effacée en même temps.
    await refresh(state.username);
    showCompare(r.data);
  } finally {
    compareRun = false;
    const b = $("compareRun");
    if (b) b.disabled = false;
    const st = $("compareState");
    if (st) st.textContent = "";
  }
}

function showCompare(d) {
  const out = $("compareOut");
  if (!out) return;
  if (!d.competitors) {
    // Relevé servi depuis la base : le fait est déjà affiché au-dessus, la
    // liste, elle, n'est pas stockée. On le dit plutôt que de laisser vide.
    out.innerHTML = `<p class="muted" style="margin:8px 0 0">Relevé déjà en base — « Refaire le relevé » pour revoir la liste des concurrents.</p>`;
    return;
  }
  if (!d.competitors.length) {
    out.innerHTML = `<p class="muted" style="margin:8px 0 0">Aucun concurrent trouvé sur « ${esc(d.metier)} ${esc(d.ville)} » — requête trop étroite ou scraper à sec.</p>`;
    return;
  }
  const rows = d.competitors
    .map((c) => `<tr class="${c.isSelf ? "self" : ""}">
        <td class="r">${esc(c.rank)}</td>
        <td class="n">${esc(c.name)}</td>
        <td class="s">${c.rating != null ? `${esc(c.rating)}★${c.reviews != null ? ` (${esc(c.reviews)})` : ""}` : "—"}</td>
        <td class="a">${ADS_LABEL[c.ads] ? `<span class="ads">${esc(ADS_LABEL[c.ads])}</span>` : ""}</td>
      </tr>`)
    .join("");
  // Absent du classement : c'est LE fait à lui dire, il mérite d'être écrit
  // plutôt que déduit d'une ligne manquante dans un tableau.
  const absent = d.facts?.rank == null
    ? `<p class="muted" style="margin:8px 0 0">Il n'apparaît nulle part dans ces résultats.</p>`
    : "";
  out.innerHTML = `<table class="comp-table">${rows}</table>${absent}`;
}

/**
 * Sa maquette — l'aperçu sur-mesure du prospect (/di/<code>).
 *
 * Elle n'était visible qu'à l'intérieur du texte de S3 : invisible en trame
 * standard, et impossible à rouvrir pendant l'appel sans aller rechercher le
 * DM. C'est pourtant la seule chose de ce panneau qui parle du prospect à sa
 * place. Elle s'affiche donc dès qu'elle existe, quelle que soit la trame.
 */
function renderDemo() {
  const link = state.data?.demoLink || "";
  const el = $("demo");
  el.hidden = !link;
  if (!link) return;
  el.innerHTML = `<div class="link-row">
      <div class="lbl"><b>Sa maquette</b><span>${esc(link)}</span></div>
      <button class="quiet" id="demoCopy">Copier</button>
      <a href="${esc(link)}" target="_blank" rel="noopener" title="Ouvrir l'aperçu">↗</a>
    </div>`;
  $("demoCopy").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(link);
      e.target.textContent = "Copié ✓";
      setTimeout(() => { e.target.textContent = "Copier"; }, 1200);
    } catch {
      $("error").textContent = "Copie refusée — clique dans le panneau puis réessaie.";
    }
  });
}

const TRAME_PICKS = [
  { trame: "standard", label: "Standard", title: "M1-M9 : la méthode complète — présentation, connexion, puis douleur au 7ᵉ message" },
  { trame: "site", label: "Site", title: "S1, S3-S5 : sa maquette dès le message qui suit son oui, puis l'appel" },
];

/**
 * Quelle trame on déroule sur ce prospect.
 *
 * C'est le seul réglage du panneau qui change TOUT ce qui suit — d'où sa
 * place sous la partition, et non dans les options : on le décide en voyant
 * le prospect, pas la veille.
 */
function renderTrameSwitch() {
  const active = state.data?.trame ?? "standard";
  $("trameSwitch").innerHTML = TRAME_PICKS.map(
    (t) => `<button data-trame="${esc(t.trame)}" class="${t.trame === active ? "on" : ""}" title="${esc(t.title)}">${esc(t.label)}</button>`,
  ).join("");

  for (const b of $("trameSwitch").querySelectorAll("[data-trame]")) {
    b.addEventListener("click", async () => {
      const pick = b.dataset.trame;
      if (pick === active) return;
      state.trame = pick;
      await rememberTrame(state.username, pick);
      // Changer de trame en cours de conversation est permis (c'est parfois
      // exactement ce qu'on veut après une réponse) : l'étape à envoyer est
      // recalculée sur le stade atteint, jamais remise à zéro.
      await refresh(state.username);
    });
  }
}

/**
 * La partition : un temps par message de la séquence (M1…M9, ou S1, S3…S5).
 *
 * La trame EST une suite ordonnée, donc la numéroter dit quelque chose de
 * vrai — ce n'est pas de la décoration. Le numéro affiché est la POSITION dans
 * la séquence, pas le chiffre du code d'étape : la trame site a perdu S2 le
 * 03/09/2026 et ses codes ne se suivent plus, alors que ses temps, si. Les
 * temps joués restent sourds, seul le temps courant est violet : la règle de
 * couleur du panneau veut que le violet ne désigne que ce qui part.
 */
function renderRail() {
  const beats = (state.data?.steps ?? []).filter((s) => /^[MS]\d$/.test(s.step));
  const nextStep = state.data?.nextStep;
  const idx = beats.findIndex((s) => s.step === nextStep);
  $("rail").innerHTML = beats
    .map((s, i) => {
      const cls = idx < 0 ? "done" : i < idx ? "done" : i === idx ? "now" : "";
      return `<span class="beat ${cls}" title="${esc(s.step)}"><i></i><b>${i + 1}</b></span>`;
    })
    .join("");

  const left = idx < 0 ? 0 : beats.length - idx - 1;
  $("railRight").textContent = nextStep
    ? `${nextStep} — ${left} temps avant le call`
    : "séquence close";
}

function renderAccount() {
  const { data, igAccount, accountId } = state;
  const el = $("account");
  const accounts = data.accounts ?? [];
  const match = accounts.find((a) => a.id === accountId);

  if (match) {
    // Un seul émetteur (le cas normal) : une jauge discrète en pied de
    // panneau. Le dépassement n'est plus un blocage — c'est une info : un DM
    // parti à la main est journalisé quoi qu'il arrive.
    // Le dépassement se lit à la TEXTURE (hachures), pas à la teinte : le
    // violet reste réservé à ce qui part.
    const over = match.sentDay >= match.daily;
    const pct = Math.min(100, Math.round((match.sentDay / Math.max(1, match.daily)) * 100));
    el.className = "quota";
    el.innerHTML = `<span>@${esc(match.username)}</span>
      <span class="gauge"><i class="${over ? "over" : ""}" style="width:${pct}%"></i></span>
      <span>${esc(match.sentDay)}/${esc(match.daily)}${over ? " dépassé" : ""}</span>`;
    return;
  }
  if (!accounts.length) {
    el.className = "warn";
    el.textContent = "Aucun compte émetteur déclaré — rien ne pourra être journalisé.";
    return;
  }
  // Plusieurs comptes et aucun apparié : choix explicite obligatoire (§ 8).
  el.className = "";
  el.innerHTML = `<div class="warn">Compte connecté${igAccount ? ` @${esc(igAccount)}` : ""} non reconnu — choisis l'émetteur :</div>
    <select id="accountSelect" style="width:100%;margin-top:4px"><option value="">— choisir —</option>
    ${accounts.map((a) => `<option value="${esc(a.id)}">@${esc(a.username)} (${esc(a.sentDay)}/${esc(a.daily)})</option>`).join("")}</select>`;
  $("accountSelect").addEventListener("change", (e) => { state.accountId = e.target.value || null; render(); });
}

/**
 * Le message rendu comme la bulle que le prospect verra — forme, alignement
 * et couleur d'un message sortant. On juge un DM à ce qu'il donne à l'arrivée,
 * pas à ce qu'il donne dans un champ de formulaire.
 */
function heroBubble(s) {
  return `<div class="bubble" id="heroBubble">${esc(s.text)}</div>
    <div class="bubble-act">
      <button data-copy="${esc(s.step)}">Copier</button>
      <button class="send" data-insert="${esc(s.step)}">Insérer<kbd>Alt+I</kbd></button>
    </div>`;
}

/** Les autres temps de la partition : consultables, jamais prioritaires. */
function stepCard(s) {
  return `<div class="step-card">
    <div class="cap"><span class="code">${esc(s.step)}</span><span class="name">${esc(s.title)}</span></div>
    <p>${esc(s.text)}</p>
    <div class="row">
      <button data-copy="${esc(s.step)}">Copier</button>
      <button data-insert="${esc(s.step)}">Insérer</button>
    </div>
  </div>`;
}

function renderTrame() {
  const { data } = state;
  const next = data.steps.find((s) => s.step === data.nextStep);
  // L'insertion est toujours proposée : écrire dans le champ ne dépend pas de
  // la présence du prospect en base — seule la JOURNALISATION en dépend.
  $("eyebrow").innerHTML = next ? `À envoyer — <em>${esc(next.step)}</em>` : "Séquence close";
  $("stepTitle").textContent = next ? next.title : "";
  $("next").innerHTML = next
    ? heroBubble(next)
    : `<div class="closed">Plus rien à envoyer depuis la trame — la balle est dans son camp.</div>`;

  const others = data.steps.filter((s) => s.step !== data.nextStep);
  $("steps").innerHTML = others.map((s) => stepCard(s)).join("");
  $("moreLabel").textContent = `Toute la trame (${others.length})`;

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

// ── Accroche vivante ───────────────────────────────────────────────────────
// La trame envoie le même M1 à tout le monde. Or le taux de réponse à froid se
// joue entièrement sur la première ligne : « vu votre réalisation de la semaine
// dernière » n'est pas de la politesse, c'est la preuve qu'un humain a regardé.
//
// La variante reste assez proche de l'accroche standard pour que `matchStep` la
// rattache à l'étape — donc elle est journalisée comme une accroche normale, et
// ni le stade ni le quota ne décrochent.

async function runHook() {
  const btn = $("hook");
  if (btn.disabled) return;
  const step = state.data?.nextStep;
  if (!/^[MS]1$/.test(step ?? "")) {
    $("error").textContent = "L'accroche vivante ne vaut que pour le premier message.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Lecture…";
  try {
    // On lit la page AU MOMENT du clic : c'est ce qui est à l'écran qui compte.
    const snap = await toTab({ type: "ig:profile" });
    if (!snap || snap.reason) { $("error").textContent = tabError(snap); return; }
    if (!snap.bio && !(snap.posts ?? []).length) {
      $("error").textContent = "Rien à lire ici — ouvre son PROFIL (pas la conversation).";
      return;
    }
    btn.textContent = "Rédaction…";
    const r = await chrome.runtime.sendMessage({
      type: "ig:hook",
      username: state.username,
      bio: snap.bio,
      posts: snap.posts,
      trame: state.data?.trame ?? null,
    });
    if (r?.status !== 200) { $("error").textContent = r?.data?.error || `Erreur ${r?.status ?? 0}`; return; }
    $("error").textContent = "";
    showHooks(r.data.variants ?? [], r.data.step);
  } finally {
    btn.disabled = false;
    btn.textContent = "Accroche vivante";
  }
}

function showHooks(list, step) {
  if (!list.length) { $("error").textContent = "Aucune variante exploitable — l'accroche standard reste la bonne."; return; }
  $("hookOut").innerHTML = list
    .map((v, i) => `<div class="card">
        <div class="tag">${esc(v.label)}</div>
        <p>${esc(v.text)}</p>
        <div class="row">
          <button data-hk-copy="${i}">Copier</button>
          <button class="primary" data-hk-insert="${i}">Insérer</button>
        </div>
      </div>`)
    .join("");

  for (const b of $("hookOut").querySelectorAll("[data-hk-copy]")) {
    b.addEventListener("click", () => {
      navigator.clipboard.writeText(list[Number(b.dataset.hkCopy)].text);
      b.textContent = "Copié ✓"; setTimeout(() => (b.textContent = "Copier"), 1200);
    });
  }
  for (const b of $("hookOut").querySelectorAll("[data-hk-insert]")) {
    b.addEventListener("click", async () => {
      // Le texte n'est PLUS celui de l'étape : on désarme, exactement comme
      // pour une reformulation. C'est `matchStep` qui rattachera l'envoi à
      // l'accroche — et s'il n'y arrive pas, mieux vaut ne rien journaliser
      // que de journaliser la mauvaise étape.
      const res = await insertRaw(list[Number(b.dataset.hkInsert)].text);
      $("error").textContent = res?.ok
        ? `Inséré — ${esc(step ?? "accroche")} sera reconnue à l'envoi.`
        : tabError(res);
    });
  }
}

$("hook").addEventListener("click", runHook);

/**
 * Insertion NON journalisable (réponse IA, ou trame sans émetteur connu).
 * Désarme d'abord : un armement laissé par une insertion précédente ferait
 * journaliser l'ANCIENNE étape au moment où ce message-ci partirait.
 */
async function insertRaw(text) {
  await chrome.runtime.sendMessage({ type: "ig:disarm" }).catch(() => {});
  state.lastArm = null;
  clearTimeout(state.fallbackTimer);
  $("fallback").hidden = true;
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
  const r = await chrome.runtime.sendMessage({
    type: "ig:arm", prospectId: p.id, accountId, step, text: s.text,
    variant: data.variantId ?? null,
  });
  if (!r?.ok) { $("error").textContent = tabError(r); return; }
  $("error").textContent = "";
  // La bulle part vers la droite : le geste à l'écran raconte ce qui vient de
  // se passer dans la conversation. Neutralisé si l'utilisateur réduit les
  // animations.
  const bubble = $("heroBubble");
  if (bubble && step === data.nextStep) bubble.classList.add("sent");
  state.lastArm = { prospectId: p.id, accountId, step, variant: data.variantId ?? null };
  // Filet § 7 : si aucun ig:logged sous 30 s après l'insertion, bouton manuel.
  // Délai généreux : un délai court faisait apparaître le bouton « Envoyé »
  // pendant la simple relecture du message, avant même qu'il soit parti,
  // ce qui invitait à journaliser un message pas encore envoyé.
  clearTimeout(state.fallbackTimer);
  state.fallbackTimer = setTimeout(() => { $("fallback").hidden = false; }, 30000);
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

// <details> natif : à l'ouverture, on relit le fil si le champ est vide.
$("ai").addEventListener("toggle", async () => {
  if ($("ai").open && !$("aiIncoming").value.trim()) await grabThread();
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
    const r = await chrome.runtime.sendMessage({ type: "ig:ai-reply", username: state.username, incoming, history, trame: state.data?.trame ?? null });
    if (r?.status !== 200) {
      $("error").textContent = r?.data?.error || `Erreur ${r?.status ?? 0}`;
      return;
    }
    $("error").textContent = "";
    const list = r.data.suggestions ?? [];
    $("aiOut").innerHTML = list
      .map((s, i) => `<div class="card">
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


/** Affiche le texte corrigé dans le panneau : à relire, à copier, à réinsérer. */
function showCorrection(text) {
  $("fixOut").innerHTML = `<div class="card">
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

// ── Reformulation en trois tons ────────────────────────────────────────────
// La phrase reste CELLE de Nicolas : on ne change que le ton. Trois variantes,
// il en choisit une — ou aucune.
//
// Différence capitale avec « Corriger » : corriger réinsère le MÊME message,
// donc l'armement survit. Reformuler CHANGE le texte, donc l'insertion passe
// par insertRaw et DÉSARME — sinon un envoi journaliserait une étape qui n'est
// plus celle qui part. Si la variante ressemble encore assez à l'étape,
// matchStep la rattrape à l'envoi (ig:sent-auto), et c'est légitime : c'est
// bien cette étape, reformulée.

function showVariants(list) {
  if (!list.length) {
    $("error").textContent = "Aucune variante exploitable — réessaie.";
    return;
  }
  $("retoneOut").innerHTML = list
    .map((v, i) => `<div class="card">
        <div class="tag">${esc(v.label)}</div>
        <p>${esc(v.text)}</p>
        <div class="row">
          <button data-rt-copy="${i}">Copier</button>
          <button data-rt-insert="${i}">Insérer</button>
        </div>
      </div>`)
    .join("");

  for (const b of $("retoneOut").querySelectorAll("[data-rt-copy]")) {
    b.addEventListener("click", () => {
      navigator.clipboard.writeText(list[Number(b.dataset.rtCopy)].text);
      b.textContent = "Copié ✓"; setTimeout(() => (b.textContent = "Copier"), 1200);
    });
  }
  for (const b of $("retoneOut").querySelectorAll("[data-rt-insert]")) {
    b.addEventListener("click", async () => {
      const res = await insertRaw(list[Number(b.dataset.rtInsert)].text);
      $("error").textContent = res?.ok ? "Inséré — relis avant d'envoyer." : tabError(res);
    });
  }
}

async function runRetone(text) {
  if (state.retoneBusy) return;
  state.retoneBusy = true;
  $("retone").disabled = true;
  $("retoneRun").disabled = true;
  $("retone").textContent = "Reformulation…";
  $("retoneOut").innerHTML = "";
  try {
    // Le fil accompagne la phrase s'il a déjà été relu — on ne déclenche pas
    // grabThread() en douce : c'est une action que Nicolas provoque lui-même.
    const history = $("aiIncoming").value.trim();
    const r = await chrome.runtime.sendMessage({
      type: "ig:retone", username: state.username, text, history,
    });
    if (r?.status !== 200) { $("error").textContent = r?.data?.error || `Erreur ${r?.status ?? 0}`; return; }
    $("error").textContent = "";
    showVariants(r.data.variants ?? []);
  } finally {
    state.retoneBusy = false;
    $("retone").disabled = false;
    $("retoneRun").disabled = false;
    $("retone").textContent = "Reformuler";
  }
}

$("retone").addEventListener("click", async () => {
  if (state.retoneBusy) return;
  const c = await toTab({ type: "ig:composer-text" });
  const typed = (c?.text ?? "").trim();
  if (typed) { await runRetone(typed); return; }
  // Le champ Instagram ne fournit rien : on retombe sur ce qui a été tapé dans
  // le repli, s'il y a quelque chose.
  const fallback = $("retoneText").value.trim();
  if (fallback) { await runRetone(fallback); return; }
  // Sinon on déplie le repli — ce n'est pas une erreur, c'est l'endroit où
  // taper la phrase.
  $("retoneInput").hidden = false;
  $("retoneText").focus();
});

$("retoneRun").addEventListener("click", async () => {
  const t = $("retoneText").value.trim();
  if (!t) { $("retoneText").focus(); return; }
  await runRetone(t);
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
    showStage(r.data.verdict);
  } finally {
    btn.disabled = false;
    btn.textContent = "Qualifier la réponse";
  }
});

function showVerdict(v) {
  if (!v?.replied || !v.kind) {
    $("qualifyOut").innerHTML = `<div class="card doubt"><div class="tag">Aucune réponse</div>
      <p>${esc(v?.reason || "Le prospect n'a pas encore répondu.")}</p></div>`;
    return;
  }
  const doubt = v.confidence !== "haute";
  $("qualifyOut").innerHTML = `<div class="card verdict ${doubt ? "doubt" : ""}">
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
      $("qualifyOut").innerHTML = `<div class="card verdict"><div class="tag">Enregistré ✓</div>
        <p class="muted">${r.data.deduped ? "Déjà enregistré aujourd'hui — rien de compté en double." : "Réponse inscrite au CRM ; le prospect sort de la file de relance."}</p></div>`;
      refresh(state.username);
    } else {
      $("error").textContent = r?.data?.error || "Enregistrement refusé.";
      btn.disabled = false;
      btn.textContent = "Enregistrer dans le CRM";
    }
  });
}

/**
 * Poser le stade À LA MAIN.
 *
 * L'IA ne propose un recalage que lorsqu'elle a lu le fil ET qu'elle conclut
 * quelque chose. Quand elle ne conclut rien — cas fréquent d'une conversation
 * qui s'éteint sans mot de refus — le stade restait faux et le prospect
 * revenait indéfiniment dans la file. Ces boutons sont la sortie manuelle.
 */
function renderStagePicker() {
  const p = state.data?.prospect;
  const box = $("stagePick");
  box.hidden = !p;
  if (!p) return;

  const current = p.stage ?? null;
  box.innerHTML = `<div class="eyebrow">Stade</div>
    <div class="row" style="margin-top:7px">
      ${STAGE_PICKS.map((s) => `<button class="stage-btn ${s.cls ?? ""} ${s.stage && s.stage === current ? "on" : ""}"
        data-pick="${s.mode ?? s.stage}" title="${esc(s.title)}">${esc(s.label)}</button>`).join("")}
      <select id="stageOther" title="Les autres stades du pipeline">
        <option value="">autre stade…</option>
        ${Object.entries(STAGE_LABEL)
          .filter(([k]) => !STAGE_PICKS.some((s) => s.stage === k))
          .map(([k, label]) => `<option value="${k}" ${k === current ? "selected" : ""}>${esc(label)}</option>`)
          .join("")}
      </select>
    </div>`;

  for (const b of box.querySelectorAll(".stage-btn")) {
    b.addEventListener("click", () => applyPick(b.dataset.pick, b));
  }
  $("stageOther").addEventListener("change", (e) => {
    if (e.target.value) applyPick(e.target.value, null);
  });
}

/** Un seul chemin d'écriture, quel que soit le bouton cliqué. */
async function applyPick(pick, btn) {
  const before = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "…"; }

  const msg = pick === "refus"
    ? { type: "ig:refus", username: state.username, accountId: state.accountId }
    : { type: "ig:set-stage", username: state.username, stage: pick };
  const r = await chrome.runtime.sendMessage(msg);

  if (r?.status === 200 && r.data?.ok) {
    $("error").textContent = "";
    $("stageOut").innerHTML = `<div class="card verdict"><div class="tag">${pick === "refus" ? "Refus compté ✓" : "Stade posé ✓"}</div>
      <p class="muted">${esc(pickOutcome(pick, r.data.action))}</p></div>`;
    refresh(state.username);
    return;
  }
  $("error").textContent = r?.data?.error || "Action refusée.";
  if (btn) { btn.disabled = false; btn.textContent = before; }
}

/** Dire ce qui vient d'être écrit — les deux axes bougent, ça doit se voir. */
function pickOutcome(pick, action) {
  if (pick === "refus") {
    return action === "reclass"
      ? "Sa réponse du jour est reclassée en refus (colonne F) et il sort du pipeline."
      : "Refus journalisé (colonne F) et il sort du pipeline.";
  }
  const label = STAGE_LABEL[pick] ?? pick;
  if (pick === "perdu") return `« ${label} » — relances coupées, sorti de la sélection du jour. Aucun refus compté.`;
  if (pick === "call_booke") return `« ${label} » — statut positif, relances coupées.`;
  return `« ${label} »`;
}

/**
 * Le stade du CRM est saisi à la main : il prend du retard dès qu'un échange
 * se fait hors de l'outil, et c'est lui qui décide de l'étape « à envoyer ».
 * On propose donc de le recaler sur ce que le fil montre vraiment.
 */
function showStage(v) {
  const current = state.data?.prospect?.stage ?? null;
  if (!v?.stage || v.stage === current) { $("stageOut").innerHTML = ""; return; }
  $("stageOut").innerHTML = `<div class="card doubt">
      <div class="tag">Stade en retard</div>
      <p>CRM : <b>${esc(STAGE_LABEL[current] ?? "Jamais contacté")}</b> · d'après le fil : <b>${esc(STAGE_LABEL[v.stage] ?? v.stage)}</b></p>
      <div class="muted">${esc(v.stageReason)}</div>
      <div class="row"><button class="primary" id="syncStage">Recaler sur « ${esc(STAGE_LABEL[v.stage] ?? v.stage)} »</button></div>
    </div>`;
  $("syncStage").addEventListener("click", async () => {
    const b = $("syncStage");
    b.disabled = true;
    b.textContent = "Recalage…";
    const r = await chrome.runtime.sendMessage({
      type: "ig:set-stage", username: state.username, stage: v.stage,
    });
    if (r?.status === 200 && r.data?.ok) {
      $("stageOut").innerHTML = `<div class="card verdict"><div class="tag">Stade recalé ✓</div>
        <p class="muted">L'étape « à envoyer » suit maintenant la conversation.</p></div>`;
      refresh(state.username);
    } else {
      $("error").textContent = r?.data?.error || "Recalage refusé.";
      b.disabled = false;
      b.textContent = "Recaler";
    }
  });
}

// ── Sparring ───────────────────────────────────────────────────────────────
// L'outil aide à envoyer ; il ne rend pas meilleur. C'est le seul adversaire
// qu'on peut affronter cinquante fois par jour sans brûler un vrai prospect.
// Rien de ce qui se passe ici n'est journalisé — s'entraîner ne doit jamais
// faire mentir les compteurs.

let sparThread = [];   // { from: "moi" | "lui", text }
let sparScores = [];

function renderSpar() {
  $("sparOut").innerHTML = sparThread
    .map((l) => `<div class="spar-line ${l.from === "moi" ? "me" : "him"}">${esc(l.text)}</div>` +
      (l.note ? `<div class="spar-note"><b>${esc(l.score)}/10</b> — ${esc(l.note)}</div>` : ""))
    .join("");
  $("sparScore").textContent = sparScores.length
    ? `moyenne ${(sparScores.reduce((a, b) => a + b, 0) / sparScores.length).toFixed(1)}/10 sur ${sparScores.length}`
    : "";
  $("sparOut").scrollTop = $("sparOut").scrollHeight;
}

$("sparReset").addEventListener("click", () => {
  sparThread = [];
  sparScores = [];
  renderSpar();
});

$("sparSend").addEventListener("click", async () => {
  const btn = $("sparSend");
  const message = $("sparText").value.trim();
  if (!message || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "…";
  try {
    const p = state.data?.prospect;
    const r = await chrome.runtime.sendMessage({
      type: "ig:spar",
      // On s'entraîne sur le prospect à l'écran quand il y en a un : le métier
      // change complètement les objections qu'on va se prendre.
      metier: p?.metier ?? "",
      ville: p?.ville ?? "",
      step: state.data?.nextStep ?? null,
      stepText: state.data?.steps?.find((s) => s.step === state.data.nextStep)?.text ?? null,
      history: sparThread.map((l) => `${l.from}: ${l.text}`).join("\n"),
      message,
    });
    if (r?.status !== 200) { $("error").textContent = r?.data?.error || `Erreur ${r?.status ?? 0}`; return; }
    $("error").textContent = "";
    const t = r.data.turn;
    sparThread.push({ from: "moi", text: message, score: t.score, note: t.note });
    sparThread.push({ from: "lui", text: t.reply });
    sparScores.push(t.score);
    $("sparText").value = "";
    renderSpar();
  } finally {
    btn.disabled = false;
    btn.textContent = "Envoyer";
  }
});

$("sparText").addEventListener("keydown", (e) => {
  // Entrée envoie, Maj+Entrée saute une ligne — comme dans un vrai DM.
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("sparSend").click(); }
});

// ── Mes liens ──────────────────────────────────────────────────────────────
// Le geste par défaut est COPIER, pas ouvrir : ces liens finissent dans un DM
// qu'on écrit à la main. Rien n'est inséré d'office dans le champ — la trame
// décide seule de ce qui part et quand (M8 ne donne aucune ressource).

async function loadLinks() {
  const { links } = await chrome.storage.local.get("links");
  const list = Array.isArray(links) && links.length ? links : NMFUtil.DEFAULT_LINKS;
  $("linksOut").innerHTML = list
    .map(
      (l, i) => `<div class="link-row">
        <div class="lbl"><b>${esc(l.label)}</b><span>${esc(l.url)}</span></div>
        <button class="quiet" data-copy="${i}">Copier</button>
        <a href="${esc(l.url)}" target="_blank" rel="noopener" title="Ouvrir">↗</a>
      </div>`,
    )
    .join("");

  $("linksOut").querySelectorAll("button[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const link = list[Number(btn.dataset.copy)];
      try {
        await navigator.clipboard.writeText(link.url);
        const before = btn.textContent;
        btn.textContent = "Copié ✓";
        setTimeout(() => { btn.textContent = before; }, 1200);
      } catch {
        // Presse-papiers refusé (panneau sans focus) : le lien reste
        // sélectionnable, mais le dire vaut mieux qu'un bouton sans effet.
        $("error").textContent = "Copie refusée — clique dans le panneau puis réessaie.";
      }
    });
  });
}

// Édition dans les options : le panneau se remet à jour sans être rouvert.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.links) loadLinks();
});

// ── File du jour : le panneau pilote, Instagram n'est plus que l'écran ─────

/**
 * Le filtre « sans site » de la file.
 *
 * Le plancher de la selection compose deja la journee, mais il n'est pas
 * toujours a 100 % : reports de la veille, plancher baisse, vivier a sec. La
 * bascule laisse enchainer les sans-site D'ABORD sans ouvrir le cockpit.
 *
 * Elle FILTRE la journee, elle ne la depasse pas : servir un profil hors
 * selection afficherait quelqu'un a qui /api/instagram/dm refuserait ensuite
 * d'ecrire (plafond de chauffe).
 *
 * Memorise dans le storage : une session de 50 DM ne doit pas redemander le
 * meme reglage a chaque ouverture du panneau.
 */
function paintQueueFilter() {
  const b = $("queueNoSite");
  b.classList.toggle("on", state.queueNoSite === true);
  b.textContent = state.queueNoSite ? "Sans site ✓" : "Sans site";
}

async function loadQueueFilter() {
  const { queueNoSite } = await chrome.storage.local.get("queueNoSite");
  state.queueNoSite = queueNoSite === true;
  paintQueueFilter();
}

function paintAssistMode() {
  const b = $("assistMode");
  b.classList.toggle("on", state.assistMode === true);
  b.textContent = state.assistMode ? "Assisté ✓" : "Assisté";
}

async function loadAssistMode() {
  const { assistMode } = await chrome.storage.local.get("assistMode");
  state.assistMode = assistMode === true;
  paintAssistMode();
}

async function loadQueue() {
  const r = await chrome.runtime
    .sendMessage({ type: "ig:queue", noSite: state.queueNoSite === true })
    .catch(() => null);
  if (r?.status !== 200) { $("queueInfo").textContent = ""; $("card").hidden = true; return null; }
  const { remaining, total, remainingNoSite, next } = r.data;
  // Les compteurs restent ceux de la JOURNEE, filtre ou pas : « 12 sur 37 »
  // doit vouloir dire la meme chose des deux cotes de la bascule. La part sans
  // site s'ajoute a cote, c'est elle qui dit ce que « Suivant » peut encore
  // servir quand le filtre est arme.
  const part = typeof remainingNoSite === "number" && remaining ? ` · ${remainingNoSite} sans site` : "";
  $("queueInfo").textContent = remaining ? `${remaining} sur ${total} à contacter${part}` : "file du jour terminée ✓";
  // Filtre arme et plus aucun sans-site ouvert : le bouton se desarme et le dit,
  // au lieu de renvoyer « Plus personne dans la file » alors qu'il en reste.
  const vide = !next?.length;
  $("nextProspect").disabled = vide;
  if (vide && remaining && state.queueNoSite) {
    $("queueInfo").textContent = `${remaining} à contacter, aucun sans site — décoche le filtre`;
  }
  renderCard(remaining);
  renderWatching(r.data.watching);
  return next?.[0] ?? null;
}

/**
 * La carte du jour — la clôture de session.
 *
 * Elle n'apparaît QUE quand la file est vide. Affichée en permanence, elle
 * deviendrait un tableau de bord de plus ; réservée à la fin, elle est la
 * seule chose du panneau qui dise « c'est fait ».
 */
async function renderCard(remaining) {
  const el = $("card");
  if (remaining !== 0) { el.hidden = true; return; }
  const r = await chrome.runtime.sendMessage({ type: "ig:session" }).catch(() => null);
  if (r?.status !== 200) { el.hidden = true; return; }
  const d = r.data;
  const num = (v, label) => `<div class="num"><b>${esc(v)}</b><span>${esc(label)}</span></div>`;
  el.hidden = false;
  el.innerHTML = `<div class="done">File du jour terminée</div>
    <div class="nums">
      ${num(d.accroches, "accroches")}
      ${num(d.reponses, d.reponses > 1 ? "réponses" : "réponse")}
      ${num(d.positives, d.positives > 1 ? "positives" : "positive")}
      ${num(d.propositions, "appels proposés")}
    </div>
    <div class="streak">${
      d.streak > 1
        ? `<b>${esc(d.streak)} jours d'affilée</b>${d.record > d.streak ? ` — record ${esc(d.record)}` : " — c'est ton record"}`
        : "Premier jour de la série."
    }</div>`;
}

/**
 * « Il regarde sa maquette, maintenant. »
 *
 * Le radar existant liste les conversations qui attendent une réponse. Celui-ci
 * passe AVANT : un prospect sur sa propre page, à cet instant, est la meilleure
 * raison d'écrire de toute la journée. Un clic ouvre son profil.
 */
function renderWatching(rows) {
  const el = $("watching");
  const list = Array.isArray(rows) ? rows : [];
  el.hidden = !list.length;
  if (!list.length) return;
  el.innerHTML = list
    .map((w) => `<button class="watch" data-watch="${esc(w.username)}">
        <b>@${esc(w.username)}</b> regarde sa maquette
        <span>${esc(NMFUtil.sinceLabel(w.at))}${w.seconds >= 20 ? ` · ${esc(Math.round(w.seconds))} s dessus` : ""}</span>
      </button>`)
    .join("");
  for (const b of el.querySelectorAll("[data-watch]")) {
    b.addEventListener("click", async () => {
      const r = await toTab({ type: "ig:navigate", url: `https://www.instagram.com/${b.dataset.watch}/` });
      if (!r?.ok) $("error").textContent = tabError(r);
    });
  }
}

$("queueNoSite").addEventListener("click", async () => {
  state.queueNoSite = state.queueNoSite !== true;
  await chrome.storage.local.set({ queueNoSite: state.queueNoSite });
  paintQueueFilter();
  await loadQueue();
});

$("assistMode").addEventListener("click", async () => {
  state.assistMode = state.assistMode !== true;
  await chrome.storage.local.set({ assistMode: state.assistMode });
  if (!state.assistMode) await chrome.storage.session.remove("assistPending");
  paintAssistMode();
  $("error").textContent = state.assistMode
    ? "Mode assisté actif — envoie avec Entrée, le M1 suivant sera préparé."
    : "Mode assisté arrêté.";
});

$("nextProspect").addEventListener("click", async () => {
  const btn = $("nextProspect");
  btn.disabled = true;
  const next = await loadQueue();
  if (!next?.username) {
    $("error").textContent = state.queueNoSite
      ? "Plus aucun profil SANS SITE dans la file du jour — décoche le filtre pour les autres."
      : "Plus personne dans la file du jour.";
    btn.disabled = false;
    return;
  }
  // Ouvre son PROFIL : c'est de là qu'on engage un premier contact, et aucun
  // identifiant de conversation n'existe encore pour un prospect jamais écrit.
  const r = await toTab({ type: "ig:navigate", url: `https://www.instagram.com/${next.username}/` });
  if (!r?.ok) $("error").textContent = tabError(r);
  btn.disabled = false;
});

// ── Le sas : Instagram sans Instagram ──────────────────────────────────────
// L'ennemi d'une session de 50 DM n'est pas la trame, c'est le fil. Tant que
// le sas est ouvert, la page d'accueil ne donne plus rien à scroller — les
// conversations, elles, ne sont jamais touchées.

async function paintSasButton(on) {
  const b = $("sas");
  b.classList.toggle("on", on);
  b.textContent = on ? "Sas ✓" : "Sas";
}

async function loadSas() {
  const { sasOn } = await chrome.storage.local.get("sasOn");
  paintSasButton(sasOn === true);
  // On (re)pose l'état sur la page : un onglet ouvert après coup, ou un
  // content script ré-injecté, doit se retrouver dans le même état.
  if (sasOn === true) toTab({ type: "ig:sas", on: true });
}

$("sas").addEventListener("click", async () => {
  const { sasOn } = await chrome.storage.local.get("sasOn");
  const next = sasOn !== true;
  await chrome.storage.local.set({ sasOn: next });
  paintSasButton(next);
  const r = await toTab({ type: "ig:sas", on: next });
  if (!r?.ok) $("error").textContent = tabError(r);
});

// ── Radar : qui attend une réponse (Instagram ne le dit nulle part) ────────

let radarRows = [];
async function loadRadar() {
  const r = await toTab({ type: "ig:inbox" });
  radarRows = r?.rows ?? [];
  $("radarStrip").hidden = !radarRows.length;
  $("radarToggle").textContent = radarRows.length === 1
    ? "1 conversation attend ta réponse"
    : `${radarRows.length} conversations attendent ta réponse`;
}

$("radarToggle").addEventListener("click", () => {
  const out = $("radarOut");
  if (out.innerHTML) { out.innerHTML = ""; return; }
  out.innerHTML = radarRows
    .map((w) => `<div class="waiting" data-open="${esc(w.index)}"><b>${esc(w.name)}</b><span>${esc(w.preview)}</span></div>`)
    .join("");
  for (const el of out.querySelectorAll("[data-open]")) {
    el.addEventListener("click", async () => {
      const r = await toTab({ type: "ig:open-inbox", index: Number(el.dataset.open) });
      if (!r?.ok) $("error").textContent = "Conversation introuvable — reviens à la boîte de réception.";
      else out.innerHTML = "";
    });
  }
});

// ── Mode chasse ────────────────────────────────────────────────────────────
// Le hasard est le meilleur scraper de la journée : un commentaire, une
// suggestion, un abonné d'un concurrent. Jusqu'ici tout ça se perdait sur la
// phrase « hors base, rien ne sera journalisé ».

$("captureRun").addEventListener("click", async () => {
  const btn = $("captureRun");
  const username = state.username || state.manual;
  if (!username || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Capture…";
  try {
    const r = await chrome.runtime.sendMessage({
      type: "ig:capture", username, ville: $("captureVille").value.trim(),
    });
    if (r?.status !== 200) {
      $("error").textContent = r?.data?.error || `Erreur ${r?.status ?? 0}`;
      return;
    }
    $("error").textContent = r.data.created
      ? `@${username} capté et scoré — la trame est journalisable.`
      : `@${username} était déjà en base.`;
    $("captureVille").value = "";
    await refresh(username);
    loadQueue();
  } finally {
    btn.disabled = false;
    btn.textContent = "Capter ce profil";
  }
});

$("captureVille").addEventListener("keydown", (e) => { if (e.key === "Enter") $("captureRun").click(); });

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
  if (r?.ok) { $("fallback").hidden = true; refresh(state.username); }
  else $("error").textContent = r?.error || "Journalisation refusée.";
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "ig:prospect-changed") {
    // Détection toujours en échec : ne pas écraser la saisie manuelle par un
    // « rien détecté » à chaque re-scan de la SPA.
    if (!msg.username && state.manual) return;
    state.manual = null;
    // Autre prospect, autre choix de trame : `refresh` relira celui qui a été
    // mémorisé pour ce pseudo. Garder l'ancien ferait dérouler la trame site
    // sur le prospect suivant sans l'avoir demandé.
    state.trame = null;
    $("fallback").hidden = true;
    clearTimeout(state.fallbackTimer);
    // Nouvelle conversation : ce qui restait du bloc IA ne la concerne pas.
    $("aiIncoming").value = "";
    $("aiOut").innerHTML = "";
    $("aiHint").textContent = "";
    $("fixOut").innerHTML = "";
    $("qualifyOut").innerHTML = "";
    $("stageOut").innerHTML = "";
    $("retoneOut").innerHTML = "";
    $("retoneText").value = "";
    $("retoneInput").hidden = true;
    refresh(msg.username, msg.account);
  }
  if (msg?.type === "ig:logged") {
    clearTimeout(state.fallbackTimer);
    $("fallback").hidden = true;
    if (msg.ok) {
      // `auto` : reconnu tout seul dans le champ, sans passer par « Insérer ».
      if (msg.auto) $("error").textContent = `${msg.auto} journalisé automatiquement.`;
      refresh(state.username); // stade avancé → nextStep suivant surligné
      loadQueue();
      refreshPace(); // un envoi de plus : la cadence vient de changer
    } else { $("error").textContent = msg.error || "Journalisation refusée."; $("fallback").hidden = false; }
  }
  if (msg?.type === "ig:assist") {
    if (msg.state === "moving") $("error").textContent = `Ouverture de @${msg.username}…`;
    if (msg.state === "skipped") {
      const cause = msg.reason === "no-contact-button" ? "aucun bouton Contacter" : "profil indisponible";
      $("error").textContent = `@${msg.username} : ${cause} — marqué Perdu, passage au suivant…`;
    }
    if (msg.state === "ready") $("error").textContent = `@${msg.username} — ${msg.step} prêt. Lis puis appuie sur Entrée.`;
    if (msg.state === "done") $("error").textContent = "File du jour terminée ✓";
    if (msg.state === "stopped") $("error").textContent = msg.error || "Mode assisté arrêté.";
  }
  // Réponse reçue détectée dans la conversation ouverte. Inscrite d'office
  // quand le modèle est sûr ; sinon le verdict s'affiche avec son bouton, la
  // décision reste à Nicolas — mais il la voit, au lieu de rater la réponse.
  if (msg?.type === "ig:reply-logged") {
    if (msg.username && state.username && msg.username !== state.username) return;
    if (!msg.ok) { $("error").textContent = msg.error || "Réponse détectée, journalisation en échec."; return; }
    const auto = msg.auto ?? {};
    if (auto.recorded) {
      $("qualifyOut").innerHTML = `<div class="card verdict"><div class="tag">Réponse enregistrée ✓</div>
        <p class="muted">${esc(KIND_LABEL[auto.kind] ?? auto.kind ?? "")} — inscrite toute seule ; le prospect sort de la file de relance.</p></div>`;
      refresh(state.username);
      loadQueue();
      return;
    }
    if (auto.reason === "deja-journalisee" || auto.reason === "pas-de-reponse") return;
    // Doute (ou erreur) : on affiche le verdict tel quel, avec son bouton.
    if (msg.verdict) { showVerdict(msg.verdict); showStage(msg.verdict); }
    if (auto.reason === "erreur" && auto.error) $("error").textContent = auto.error;
  }
  if (msg?.type === "ig:shortcut" && msg.ok === false) {
    $("error").textContent = "Raccourci sans effet — vérifie que la conversation est ouverte.";
  }
});

// Au montage : re-scan de la page (les content scripts sont ré-injectés si le
// rechargement de l'extension les a orphelinés), puis chargement du contexte.
(async () => {
  const r = await toTab({ type: "ig:rescan" });
  if (r?.reason && r.reason !== "not-instagram") $("error").textContent = tabError(r);
  // AVANT loadQueue : sinon la premiere file part sans le filtre memorise, et
  // « Suivant » ouvrirait un profil avec site alors que la bascule est armee.
  await loadQueueFilter();
  await loadAssistMode();
  refresh(null);
  loadQueue();
  loadRadar();
  loadLinks();
  refreshPace();
  loadSas();
  // Laisse au content script fraîchement injecté le temps d'annoncer le
  // prospect : à la première passe, le contexte est encore vide.
  setTimeout(() => { if (!state.manual) refresh(null); }, 600);
})();
