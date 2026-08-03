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
  return { dedupeKey, shouldLog, prune };
})();
if (typeof module !== "undefined") module.exports = NMFUtil;
