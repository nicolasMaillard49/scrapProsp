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

  return { dedupeKey, shouldLog, prune, pickAccountId };
})();
if (typeof module !== "undefined") module.exports = NMFUtil;
