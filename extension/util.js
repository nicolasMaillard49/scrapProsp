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
   * Le prospect a-t-il parlé en DERNIER ? Rend son dernier bloc de messages,
   * ou null.
   *
   * Deux garde-fous, car ce qui sort d'ici déclenche une écriture au CRM :
   *  - un fil qui se termine par une ligne d'auteur INDÉTERMINÉ (`?`) ne
   *    conclut rien — mieux vaut ne rien journaliser qu'inscrire un de nos
   *    propres messages comme réponse du prospect ;
   *  - sans aucun message de nous en amont, ce n'est pas une réponse : c'est
   *    une prise de contact entrante, qui ne dit rien de notre accroche.
   */
  function pendingIncoming(rows, sentTexts = []) {
    const known = new Set(sentTexts.map(norm).filter(Boolean));
    const list = (Array.isArray(rows) ? rows : [])
      .filter((r) => r && String(r.text ?? "").trim())
      .map((r) => {
        let who = r.from === "moi" ? "moi" : r.from === "lui" ? "lui" : "?";
        if (who === "?" && known.has(norm(r.text))) who = "moi";
        return { from: who, text: String(r.text).replace(/\s+/g, " ").trim() };
      });
    const last = list[list.length - 1];
    if (!last || last.from !== "lui") return null;
    if (!list.some((r) => r.from === "moi")) return null;
    const block = [];
    for (let i = list.length - 1; i >= 0 && list[i].from === "lui"; i--) block.unshift(list[i].text);
    return { text: block.join(" "), lines: block.length };
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

  return {
    dedupeKey, shouldLog, prune, pickAccountId, formatThread, splitThread,
    parisDay, replyKey, similarity, matchStep, pendingIncoming, incomingKey,
  };
})();
if (typeof module !== "undefined") module.exports = NMFUtil;
