// extension/util.js — helpers PURS du background (testés sous node).
const NMFUtil = (() => {
  /** Jour civil Europe/Paris — les quotas de l'app comptent en heure française. */
  function parisDay(now) {
    return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(now); // YYYY-MM-DD
  }
  function dedupeKey(prospectId, step, now) {
    return `sent:${prospectId}:${step}:${parisDay(now)}`;
  }
  function shouldLog(sentKeys, key) {
    return !sentKeys.includes(key);
  }
  /** Le pilote ne passe au suivant qu'après une première accroche certaine. */
  function shouldAdvanceAssist(enabled, step, result) {
    return enabled === true && (step === "M1" || step === "S1") && result?.ok === true && result?.deduped !== true;
  }
  /** Premier profil valide de la file, sauf celui que l'on vient d'écarter. */
  function nextQueueProspect(rows, excludedUsername = null) {
    const excluded = String(excludedUsername ?? "").replace(/^@/, "").trim().toLowerCase();
    return (Array.isArray(rows) ? rows : []).find((row) => {
      const username = String(row?.username ?? "").replace(/^@/, "").trim().toLowerCase();
      return username && username !== excluded;
    }) ?? null;
  }
  function prune(sentKeys, max = 200) {
    return sentKeys.length <= max ? sentKeys : sentKeys.slice(sentKeys.length - max);
  }

  /**
   * Compte émetteur à retenir pour journaliser.
   *
   * Un SEUL compte déclaré → c'est lui, sans question : la règle « jamais
   * deviné » existe pour ne pas attribuer un DM au mauvais compte parmi
   * plusieurs. Avec un seul émetteur possible, il n'y a rien à deviner et le
   * sélecteur ne fait que rajouter un clic à chaque conversation.
   * Plusieurs comptes → appariement strict par pseudo détecté, sinon null
   * (choix explicite obligatoire côté UI).
   */
  function pickAccountId(accounts, detectedUsername) {
    const list = Array.isArray(accounts) ? accounts : [];
    if (list.length === 1) return list[0].id;
    const match = list.find((a) => a && a.username === detectedUsername);
    return match ? match.id : null;
  }

  // ── Fil de conversation ──────────────────────────────────────────────────
  // Format d'échange : une ligne par message, préfixée par son auteur.
  //   moi: …   ce que Nicolas a envoyé
  //   lui: …   ce que le prospect a écrit
  //   ?: …     auteur indéterminé — à corriger d'un caractère

  const SPEAKER = /^\s*(moi|lui|prospect|me|him|her|\?)\s*:\s?([\s\S]*)$/i;
  const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

  /**
   * Met en texte le fil détecté. Les auteurs restés indéterminés sont d'abord
   * confrontés aux messages que l'app dit avoir été envoyés (la trame) : un
   * texte qui EST un message de la trame vient forcément de Nicolas.
   */
  function formatThread(rows, sentTexts = []) {
    const known = new Set(sentTexts.map(norm).filter(Boolean));
    return (Array.isArray(rows) ? rows : [])
      .filter((r) => r && String(r.text ?? "").trim())
      .map((r) => {
        let who = r.from === "moi" ? "moi" : r.from === "lui" ? "lui" : "?";
        if (who === "?" && known.has(norm(r.text))) who = "moi";
        // Une ligne par message : les retours et espaces multiples du DOM
        // d'Instagram casseraient le format « auteur: message ».
        return `${who}: ${String(r.text).replace(/\s+/g, " ").trim()}`;
      })
      .join("\n");
  }

  /**
   * Sépare le fil édité en (fil complet, dernier message du prospect).
   * Sans aucun préfixe reconnu, tout le texte est pris pour le message du
   * prospect — le cas « je colle juste ce qu'il m'a écrit » doit marcher.
   */
  function splitThread(text) {
    const raw = String(text ?? "").trim();
    if (!raw) return { incoming: "", history: "" };
    const blocks = [];
    for (const line of raw.split(/\r?\n/)) {
      const m = SPEAKER.exec(line);
      if (m) {
        const who = /^(moi|me)$/i.test(m[1]) ? "moi" : m[1] === "?" ? "?" : "lui";
        blocks.push({ from: who, text: m[2] });
      } else if (blocks.length) {
        blocks[blocks.length - 1].text += `\n${line}`; // suite du message précédent
      } else {
        blocks.push({ from: "?", text: line });
      }
    }
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].from === "lui") return { incoming: blocks[i].text.trim(), history: raw };
    }
    return { incoming: raw, history: "" };
  }

  // ── Reconnaissance d'une étape envoyée ───────────────────────────────────
  // Nicolas écrit souvent à la main, sans passer par « Insérer ». Sans
  // reconnaissance, ces envois ne sont jamais journalisés et le stade décroche
  // — c'est exactement ce qui s'est produit sur la conversation de Thomas.

  const words = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter((w) => w.length > 2);

  /**
   * Proximité entre le texte envoyé et un message de la trame, dans [0,1].
   * Mesure de RECOUVREMENT (combien des mots de la trame se retrouvent dans
   * l'envoi), pas d'égalité : Nicolas retouche presque toujours le message
   * avant de l'envoyer, et un ajout de sa part ne doit pas faire chuter le
   * score.
   */
  function similarity(sent, step) {
    const a = new Set(words(sent));
    const b = words(step);
    if (!a.size || !b.length) return 0;
    let hit = 0;
    for (const w of new Set(b)) if (a.has(w)) hit++;
    return hit / new Set(b).size;
  }

  /**
   * Étape de la trame que ce texte envoyé represente, ou null.
   * Le seuil est volontairement haut : journaliser la MAUVAISE étape fausse le
   * stade et la relance, alors que ne rien journaliser reste rattrapable à la
   * main. Un écart net avec le second candidat est aussi exigé — deux étapes
   * proches ne doivent pas se départager sur un cheveu.
   */
  function matchStep(sent, steps, opts = {}) {
    const min = opts.min ?? 0.7;
    const gap = opts.gap ?? 0.12;
    const scored = (Array.isArray(steps) ? steps : [])
      .map((s) => ({ step: s.step, score: similarity(sent, s.text) }))
      .sort((x, y) => y.score - x.score);
    const best = scored[0];
    if (!best || best.score < min) return null;
    const second = scored[1];
    if (second && best.score - second.score < gap) return null;
    return { step: best.step, score: best.score };
  }

  /**
   * Ce message sortant mérite-t-il d'être journalisé à l'étape ATTENDUE, faute
   * de ressembler à une étape de la trame ?
   *
   * `matchStep` ne reconnaît qu'un message copié de la trame. Or dès qu'un
   * prospect pose une question — « c'est à dire ? » —, la réponse s'écrit à la
   * main et ne ressemble à rien du script. Elle n'était donc jamais inscrite :
   * mesuré le 05/08 sur 30 jours, 584 accroches pour 38 suites journalisées,
   * alors que 56 prospects avaient répondu. Le prospect passait pour abandonné,
   * la relance continuait de tourner, et certains ont fini « perdu » après avoir
   * écrit « oui bien sûr ».
   *
   * On ne journalise pas n'importe quoi pour autant : un « ok », un merci ou un
   * emoji ne sont pas l'étape suivante de la trame. Il faut une vraie phrase.
   */
  function estMessageLibre(sent, opts = {}) {
    const min = opts.min ?? 25;
    const texte = String(sent || "").trim();
    if (texte.length < min) return false;
    // Retire emojis et ponctuation : « 👍👍👍 super merci !!! » n'est pas un M2.
    const lettres = texte.replace(/[^\p{L}\p{N}]/gu, "");
    if (lettres.length < min) return false;
    // Un acquittement poli reste un acquittement, même allongé.
    const politesse =
      /^(ok|d'?accord|super|parfait|merci|nickel|top|ça marche|ca marche|bien reçu|bien recu|à bientôt|a bientot|bonne journée|bonne journee|bonne soirée|bonne soiree|avec plaisir|de rien|👍|🙏)[\s!.,;:)👍🙏😊🙂]*$/iu;
    if (politesse.test(texte)) return false;
    return true;
  }

  /** Clé d'idempotence d'une réponse qualifiée : une par prospect et par jour. */
  function replyKey(username, now) {
    return `reply:${String(username || "?").toLowerCase()}:${parisDay(now)}`;
  }

  // ── Réponse entrante en attente ──────────────────────────────────────────
  // L'auto-journalisation ne couvrait que le SORTANT : une réponse reçue
  // n'entrait au CRM que si Nicolas cliquait « Qualifier » puis « Enregistrer ».
  // Une journée de réponses traitées à la main ne laissait donc aucune trace —
  // prospects maintenus dans la file de relance, KPI d'accroche sous-comptés.

  /**
   * Dernier bloc de messages du prospect, ou null.
   *
   * `last` dit s'il a parlé en DERNIER — donc si la réponse est encore en
   * attente. Ce drapeau existe parce que la réponse d'un prospect DÉJÀ traité
   * disparaît sinon : relevé sur la vraie boîte, 14 conversations sur 15
   * commençaient par « Vous : » — Nicolas répond dans la foulée, et le fil se
   * termine par SON message. Se limiter au dernier locuteur revenait à ne
   * capter que les réponses non traitées, c'est-à-dire presque aucune.
   *
   * Deux garde-fous, car ce qui sort d'ici déclenche une écriture au CRM :
   *  - un bloc entrant d'auteur INDÉTERMINÉ (`?`) ne conclut rien — mieux vaut
   *    ne rien journaliser qu'inscrire un de nos propres messages comme
   *    réponse du prospect ;
   *  - sans aucun message de nous AVANT, ce n'est pas une réponse : c'est une
   *    prise de contact entrante, qui ne dit rien de notre accroche.
   */
  function incomingReply(rows, sentTexts = []) {
    const known = new Set(sentTexts.map(norm).filter(Boolean));
    const list = (Array.isArray(rows) ? rows : [])
      .filter((r) => r && String(r.text ?? "").trim())
      .map((r) => {
        let who = r.from === "moi" ? "moi" : r.from === "lui" ? "lui" : "?";
        if (who === "?" && known.has(norm(r.text))) who = "moi";
        return { from: who, text: String(r.text).replace(/\s+/g, " ").trim() };
      });
    // Dernier message du prospect, où qu'il soit dans le fil.
    let end = -1;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].from === "lui") { end = i; break; }
    if (end < 0) return null;
    if (!list.slice(0, end).some((r) => r.from === "moi")) return null;

    const block = [];
    for (let i = end; i >= 0 && list[i].from === "lui"; i--) block.unshift(list[i].text);
    // Ce qui suit son bloc : rien = il attend ; un `?` = on ne conclut rien.
    const after = list.slice(end + 1);
    if (after.some((r) => r.from === "?")) return null;
    return { text: block.join(" "), lines: block.length, last: after.length === 0 };
  }

  /**
   * Clé d'un message entrant PRÉCIS — pour ne pas rappeler le modèle à chaque
   * passe du radar sur la même réponse. Distincte de `replyKey`, qui borne
   * l'écriture au CRM : ici on borne l'APPEL, y compris quand il ne conclut
   * rien (doute, autorépondeur), sinon un fil resté à l'écran relance la
   * qualification indéfiniment.
   */
  function incomingKey(username, text) {
    return `in:${String(username || "?").toLowerCase()}:${norm(text).slice(0, 140)}`;
  }

  // ── État de réponse du prospect ──────────────────────────────────────────

  /** Ancienneté en clair. Jamais « il y a 0 j » : sous une heure, c'est récent. */
  function sinceLabel(iso, now = new Date()) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    const min = Math.floor((now.getTime() - t) / 60000);
    if (min < 0) return "à l'instant"; // horloge décalée : ne jamais afficher un futur
    if (min < 60) return min <= 1 ? "à l'instant" : `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h`;
    const j = Math.floor(h / 24);
    if (j < 7) return `il y a ${j} j`;
    const sem = Math.floor(j / 7);
    return sem < 5 ? `il y a ${sem} sem` : `il y a ${Math.floor(j / 30)} mois`;
  }

  /**
   * A-t-il déjà répondu, et quand ?
   *
   * Ce qui se joue ici : ne pas confondre une VRAIE nouvelle réponse avec une
   * conversation qu'on poursuit. Un prospect qui a déjà répondu ne redevient
   * jamais une réponse à froid — seule la première compte, et elle est déjà
   * comptée. C'est aussi ce que l'auto-journalisation applique : elle
   * n'inscrit un fil déjà traité que si `reply_count === 0`.
   *
   * `tone` : "attente" (jamais répondu), "engage" (a répondu), "vierge"
   * (jamais contacté — il n'y a rien à attendre).
   */
  function replyState(p, now = new Date()) {
    if (!p) return null;
    const n = Number(p.reply_count || 0);
    if (n > 0) {
      const since = sinceLabel(p.last_reply_at, now);
      return {
        tone: "engage",
        text: `A répondu${since ? ` · ${since}` : ""}`,
        detail: n > 1 ? `${n} réponses — conversation en cours` : "conversation en cours",
      };
    }
    const since = sinceLabel(p.last_dm_at, now);
    if (!p.last_dm_at) return { tone: "vierge", text: "Jamais contacté", detail: "" };
    return {
      tone: "attente",
      text: `Jamais répondu${since ? ` · accroche ${since}` : ""}`,
      detail: "sa prochaine réponse sera une réponse à froid",
    };
  }

  // ── Mes liens ────────────────────────────────────────────────────────────
  // Les liens qu'on colle dix fois par jour dans un DM. Ils vivaient dans les
  // marque-pages : retrouver le bon coupait la conversation en deux.

  const DEFAULT_LINKS = [
    { label: "Audit gratuit — 20 min", url: "https://rdv.nmf-agence.com/nicolas/reunion-nicolas-maillard" },
    { label: "Entretien exceptionnel", url: "https://rdv.nmf-agence.com/nicolas/entretien-exceptionnel" },
    { label: "Simulateur ROI", url: "https://bienvenue.nmf-agence.com/simulateur" },
    { label: "Formulaire d'audit", url: "https://bienvenue.nmf-agence.com/audit" },
    { label: "Site de l'agence", url: "https://nmf-agence.com" },
  ];

  /**
   * Liste éditable dans les options : une ligne `Libellé | https://…`.
   *
   * Une ligne sans URL valide est ÉCARTÉE, pas conservée à moitié : coller un
   * lien tronqué dans un DM se voit une fois qu'il est parti. Le libellé est
   * facultatif — sans lui, l'URL se nomme elle-même.
   */
  function parseLinks(text) {
    return String(text ?? "")
      .split(/\r?\n/)
      .map((line) => {
        const raw = line.trim();
        if (!raw || raw.startsWith("#")) return null;
        const i = raw.indexOf("|");
        const label = i >= 0 ? raw.slice(0, i).trim() : "";
        const url = (i >= 0 ? raw.slice(i + 1) : raw).trim();
        if (!/^https:\/\/\S+$/.test(url)) return null;
        return { label: label || url.replace(/^https:\/\//, ""), url };
      })
      .filter(Boolean);
  }

  // ── Métronome de chauffe ─────────────────────────────────────────────────
  // Le plafond jour dit quand on est allé TROP LOIN. Il ne dit rien du
  // RYTHME — or c'est la cadence, pas le total, qui fait ressembler un compte
  // à un robot : 12 DM en quatre minutes est un signal que 12 DM en une heure
  // n'envoie pas. Un compte perdu, c'est le pipeline entier qui tombe.

  /** Intervalle minimum souhaité entre deux envois, en secondes. */
  const PACE_MIN_S = 45;
  /** Nombre d'envois récents gardés pour juger la cadence. */
  const PACE_WINDOW = 12;

  /** Ajoute un envoi à l'historique de cadence (horodatages, plus récent en fin). */
  function pushSend(stamps, now) {
    const t = now instanceof Date ? now.getTime() : Number(now);
    const list = (Array.isArray(stamps) ? stamps : []).filter((x) => Number.isFinite(x));
    return prune([...list, t], PACE_WINDOW);
  }

  /**
   * État du métronome : combien de secondes attendre avant le prochain envoi.
   *
   * `wait` > 0 = trop tôt. `burst` compte les envois de la dernière minute —
   * c'est lui qui justifie le message, un délai seul se lit comme une lubie.
   * Jamais un blocage : le panneau freine, l'humain décide. Refuser d'insérer
   * un message ne ferait que le faire taper à la main, sans le compteur.
   */
  function paceState(stamps, now, minSeconds = PACE_MIN_S) {
    const t = now instanceof Date ? now.getTime() : Number(now);
    const list = (Array.isArray(stamps) ? stamps : []).filter((x) => Number.isFinite(x) && x <= t);
    if (!list.length) return { wait: 0, burst: 0, last: null };
    const last = Math.max(...list);
    const elapsed = Math.floor((t - last) / 1000);
    return {
      wait: Math.max(0, minSeconds - elapsed),
      burst: list.filter((x) => t - x <= 60_000).length,
      last,
    };
  }

  /** Remet la liste au format des options (une ligne par lien). */
  function serializeLinks(links) {
    return (Array.isArray(links) ? links : []).map((l) => `${l.label} | ${l.url}`).join("\n");
  }

  return {
    dedupeKey, shouldLog, shouldAdvanceAssist, nextQueueProspect, prune, estMessageLibre, pickAccountId, formatThread, splitThread,
    parisDay, replyKey, similarity, matchStep, incomingReply, incomingKey,
    DEFAULT_LINKS, parseLinks, serializeLinks, sinceLabel, replyState,
    pushSend, paceState, PACE_MIN_S,
  };
})();
if (typeof module !== "undefined") module.exports = NMFUtil;
