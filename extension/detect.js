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

  /** Pseudo tiré d'un lien de profil portant un avatar, dans un périmètre donné. */
  function fromAvatarLinks(scope) {
    for (const a of scope.querySelectorAll("a[href]")) {
      const alt = a.querySelector("img[alt]")?.getAttribute("alt") || "";
      if (/photo de profil|profile photo|profile picture/i.test(alt)) {
        const u = usernameFromHref(a.getAttribute("href"));
        if (u) return u;
      }
    }
    return null;
  }

  /**
   * Pseudo du viewer dans les JSON qu'Instagram embarque dans la page.
   * Indépendant de la mise en page — donc valable aussi dans /direct/, où la
   * barre de navigation est réduite à des icônes sans avatar.
   */
  const VIEWER_KEYS = /"(?:viewer|logged_in_user|currentUser)"\s*:\s*\{[^{}]{0,600}?"username"\s*:\s*"([A-Za-z0-9._]{2,30})"/;
  function viewerFromScripts(doc) {
    const scripts = Array.from(doc.querySelectorAll("script")).slice(0, 40);
    for (const s of scripts) {
      const txt = s.textContent || "";
      if (txt.length < 20 || txt.length > 3_000_000) continue;
      if (!txt.includes("username")) continue;
      const m = VIEWER_KEYS.exec(txt);
      if (m) return clean(m[1]);
    }
    return null;
  }

  /**
   * Pseudo du compte Instagram CONNECTÉ.
   *
   * `opts.exclude` : pseudo de la conversation ouverte. Indispensable dans un
   * DM — le header y affiche l'avatar du PROSPECT, et le prendre pour le
   * compte connecté ferait créditer ses quotas de chauffe au mauvais compte.
   */
  function loggedInAccount(doc, opts = {}) {
    try {
      const exclude = opts.exclude ? String(opts.exclude).toLowerCase() : null;
      const ok = (u) => (u && u !== exclude ? u : null);

      // 1. Barre de navigation : son propre profil, jamais celui d'un tiers.
      const nav = doc.querySelector("nav");
      const fromNav = nav ? ok(fromAvatarLinks(nav)) : null;
      if (fromNav) return fromNav;

      // 2. JSON embarqué — marche dans /direct/ où la nav n'a pas d'avatar.
      const fromJson = ok(viewerFromScripts(doc));
      if (fromJson) return fromJson;

      // 3. Dernier repli : tout le document, en excluant la conversation.
      return ok(fromAvatarLinks(doc));
    } catch {
      return null;
    }
  }

  /** Lignes de service d'un fil (accusés, horodatages) — pas des messages. */
  const NOISE = /^(vu|seen|envoyé|sent|remis|delivered|aujourd'hui|today|hier|yesterday|\d{1,2}:\d{2}|\d{1,2}\s*\w+\s*\d{2,4})$/i;
  /** Instagram étiquette les messages sortants dans le nom accessible. */
  const OWN_LABEL = /vous avez envoyé|vous avez répondu|you sent|you replied/i;

  /**
   * Fil de la conversation ouverte, du plus ancien au plus récent —
   * best-effort, jamais d'exception.
   *
   * Rend `[{ from: "moi" | "lui" | "?", text }]`. L'auteur est déterminé par
   * stratégies décroissantes en fiabilité : nom accessible (« Vous avez
   * envoyé… »), puis avatar du prospect dans la ligne, puis alignement
   * calculé (les messages sortants sont poussés à droite).
   *
   * Quand aucune stratégie ne tranche, l'auteur reste « ? » : mieux vaut
   * l'afficher comme incertain — Nicolas corrige la ligne en deux secondes —
   * que d'attribuer son propre message au prospect et faire répondre l'IA à
   * côté.
   */
  function conversationThread(doc, opts = {}) {
    try {
      const maxRows = opts.maxRows ?? 40;
      const win = opts.win || (typeof window !== "undefined" ? window : null);
      const rows = Array.from(doc.querySelectorAll('div[role="row"]'));
      const slice = rows.slice(Math.max(0, rows.length - maxRows));
      const out = [];
      for (const row of slice) {
        const text = (row.innerText || row.textContent || "").trim();
        if (!text || NOISE.test(text)) continue;

        let from = "?";
        // 1. Nom accessible de la ligne ou d'un descendant.
        const labels = [row.getAttribute("aria-label") || ""];
        for (const el of row.querySelectorAll("[aria-label]")) labels.push(el.getAttribute("aria-label") || "");
        if (labels.some((l) => OWN_LABEL.test(l))) from = "moi";

        // 2. Avatar du prospect dans la ligne → message entrant.
        if (from === "?" && opts.username) {
          const alts = Array.from(row.querySelectorAll("img[alt]")).map((i) => i.getAttribute("alt") || "");
          if (alts.some((a) => a.toLowerCase().includes(String(opts.username).toLowerCase()))) from = "lui";
        }

        // 3. Alignement calculé : sortant = poussé à droite. Repli seulement,
        //    et seulement si le navigateur sait vraiment calculer le style.
        if (from === "?" && win && typeof win.getComputedStyle === "function") {
          try {
            const st = win.getComputedStyle(row);
            const j = `${st.justifyContent || ""} ${st.alignSelf || ""}`;
            if (/flex-end|right|end/.test(j)) from = "moi";
            else if (/flex-start|left/.test(j)) from = "lui";
          } catch { /* style indisponible : on laisse « ? » */ }
        }

        out.push({ from, text: text.slice(0, 1000) });
      }
      return out;
    } catch {
      return [];
    }
  }

  /** Dernier message REÇU (repli quand on ne veut que celui-là). */
  function lastIncomingText(doc, opts = {}) {
    const thread = conversationThread(doc, opts);
    for (let i = thread.length - 1; i >= 0; i--) {
      if (thread[i].from !== "moi") return thread[i].text;
    }
    return null;
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

  return { currentUsername, composerNode, loggedInAccount, watchSend, usernameFromHref, lastIncomingText, conversationThread };
})();

// Export de test (node) — inerte dans le navigateur.
if (typeof module !== "undefined") module.exports = NMFDetect;
