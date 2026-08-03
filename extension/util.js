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

  /** Clé d'idempotence d'une réponse qualifiée : une par prospect et par jour. */
  function replyKey(username, now) {
    return `reply:${String(username || "?").toLowerCase()}:${parisDay(now)}`;
  }

  return { dedupeKey, shouldLog, prune, pickAccountId, formatThread, splitThread, parisDay, replyKey };
})();
if (typeof module !== "undefined") module.exports = NMFUtil;
