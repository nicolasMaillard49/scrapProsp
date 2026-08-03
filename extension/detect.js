// ══════════════════════════════════════════════════════════════════════
// SEUL module couplé au DOM d'Instagram. Quand Instagram change son front,
// c'est ICI (et uniquement ici) qu'on répare. Chaque fonction essaie ses
// stratégies de la plus stable (URL, ARIA) à la plus fragile (arborescence),
// et rend null sans jamais jeter.
// Script classique (pas un module ES) : content scripts MV3 en scope partagé.
// ══════════════════════════════════════════════════════════════════════

const NMFDetect = (() => {
  // Segments de premier niveau qui ne sont PAS des profils.
  const RESERVED = new Set([
    "direct", "explore", "reels", "reel", "stories", "p", "accounts",
    "about", "developer", "legal", "session", "challenge", "graphql",
  ]);

  const clean = (s) => (s || "").replace(/^@/, "").trim().toLowerCase() || null;

  /** Pseudo depuis un href de profil ("/laura_x/" → "laura_x"). */
  function usernameFromHref(href) {
    const m = /^\/([A-Za-z0-9._]{2,30})\/?$/.exec(href || "");
    if (!m || RESERVED.has(m[1].toLowerCase())) return null;
    return clean(m[1]);
  }

  /** Pseudo du profil ou de la conversation ouverte. */
  function currentUsername(loc, doc) {
    try {
      const path = loc.pathname;
      // 1. Page profil : le pseudo est dans l'URL — la stratégie la plus stable.
      const direct = usernameFromHref(path);
      if (direct) return direct;
      // 2. Conversation (/direct/t/…) : lien de profil dans le header.
      if (/^\/direct\/t\//.test(path)) {
        const header = doc.querySelector("header");
        if (header) {
          for (const a of header.querySelectorAll("a[href]")) {
            const u = usernameFromHref(a.getAttribute("href"));
            if (u) return u;
          }
          // 3. Repli : alt de l'avatar « Photo de profil de <pseudo> ».
          const img = header.querySelector("img[alt]");
          const m = /photo de profil de (@?[A-Za-z0-9._]+)/i.exec(img?.getAttribute("alt") || "");
          if (m) return clean(m[1]);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Le contenteditable du champ de message. */
  function composerNode(doc) {
    try {
      return (
        doc.querySelector('div[contenteditable="true"][aria-label]') ||
        doc.querySelector('div[contenteditable="true"][role="textbox"]') ||
        null
      );
    } catch {
      return null;
    }
  }

  /** Pseudo du compte Instagram CONNECTÉ (lien nav vers son propre profil). */
  function loggedInAccount(doc) {
    try {
      const scopes = [doc.querySelector("nav"), doc].filter(Boolean);
      for (const scope of scopes) {
        for (const a of scope.querySelectorAll("a[href]")) {
          const alt = a.querySelector("img[alt]")?.getAttribute("alt") || "";
          if (/photo de profil|profile photo|profile picture/i.test(alt)) {
            const u = usernameFromHref(a.getAttribute("href"));
            if (u) return u;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Texte du dernier message REÇU dans la conversation ouverte — best-effort.
   *
   * Ne sert qu'à pré-remplir un champ que Nicolas relit et corrige avant de
   * générer une réponse : une détection approximative coûte une correction,
   * jamais une donnée fausse en base. Rend null dès qu'on n'a rien de
   * plausible, plutôt que de rendre n'importe quoi.
   */
  function lastIncomingText(doc, opts = {}) {
    try {
      const maxRows = opts.maxRows ?? 40;
      const rows = Array.from(doc.querySelectorAll('div[role="row"]'));
      for (let i = rows.length - 1; i >= 0 && i >= rows.length - maxRows; i--) {
        const row = rows[i];
        // Un message sortant est étiqueté « Vous avez envoyé… » / « You sent… »
        // par Instagram : c'est le seul marqueur fiable pour l'écarter.
        const own = row.getAttribute("aria-label") || "";
        const nested = row.querySelector("[aria-label]")?.getAttribute("aria-label") || "";
        if (/vous avez envoyé|you sent/i.test(`${own} ${nested}`)) continue;
        const text = (row.innerText || row.textContent || "").trim();
        if (!text) continue;
        // Accusés de lecture et horodatages isolés : ce n'est pas un message.
        if (/^(vu|seen|envoyé|sent|remis|delivered|\d{1,2}:\d{2})$/i.test(text)) continue;
        return text.slice(0, 2000);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Appelle cb() UNE fois quand le champ passe de rempli à vide (= envoyé).
   * Polling léger plutôt que MutationObserver : Instagram remplace parfois le
   * nœud entier à l'envoi, l'observer se retrouverait orphelin.
   */
  function watchSend(node, cb, opts = {}) {
    if (!node) return () => {};
    const intervalMs = opts.intervalMs ?? 300;
    const win = opts.win || (typeof window !== "undefined" ? window : null);
    if (!win) return () => {};
    let wasFilled = (node.textContent || "").trim().length > 0;
    let done = false;
    const id = win.setInterval(() => {
      if (done) return;
      if (!node.isConnected) {
        // Nœud recyclé/retiré par Instagram (React) ≠ envoi : on arrête le
        // poll sans déclencher cb, sinon un simple changement de vue serait
        // pris pour un message envoyé.
        done = true;
        win.clearInterval(id);
        return;
      }
      const filled = (node.textContent || "").trim().length > 0;
      if (wasFilled && !filled) {
        done = true;
        win.clearInterval(id);
        try { cb(); } catch { /* le callback ne doit pas tuer le poll suivant */ }
      }
      wasFilled = filled;
    }, intervalMs);
    return () => { done = true; win.clearInterval(id); };
  }

  return { currentUsername, composerNode, loggedInAccount, watchSend, usernameFromHref, lastIncomingText };
})();

// Export de test (node) — inerte dans le navigateur.
if (typeof module !== "undefined") module.exports = NMFDetect;
