// Logs visuels de la chaîne de scraping Instagram.
//
// But : rendre lisible dans les logs Vercel POURQUOI une chasse de prospects
// tombe — quelle source est tentée, laquelle est sautée et pour quelle raison,
// quel code HTTP remonte, quel quota RapidAPI est renvoyé. Chaque ligne porte
// un préfixe `[ig:…]` et une icône, donc grep-able d'un coup d'œil dans le
// dashboard Vercel (onglet Logs) ou `vercel logs`.
//
// Activé par défaut ; poser IG_DEBUG=0 pour couper (aucune ligne émise).
//
// ⚠️ Ne JAMAIS logguer la clé/le token — uniquement leur présence (oui/NON).

const ENABLED = process.env.IG_DEBUG !== "0";

type Level = "info" | "ok" | "warn" | "err" | "step" | "quota";

const ICON: Record<Level, string> = {
  info: "🔎",
  ok: "✅",
  warn: "⚠️",
  err: "❌",
  step: "🔄",
  quota: "📊",
};

/**
 * Émet une ligne de log visuelle. `scope` situe l'étape (chain, apify, looter…),
 * `extra` est un petit objet de contexte (jamais un profil complet : on logue
 * des compteurs et des raisons, pas des payloads).
 */
export function iglog(level: Level, scope: string, msg: string, extra?: Record<string, unknown>): void {
  if (!ENABLED) return;
  const head = `${ICON[level]} [ig:${scope}] ${msg}`;
  const tail = extra && Object.keys(extra).length ? " " + safeJson(extra) : "";
  const line = head + tail;
  if (level === "err" || level === "warn") console.error(line);
  else console.log(line);
}

/** JSON défensif : ne casse jamais un log à cause d'une valeur circulaire. */
function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
