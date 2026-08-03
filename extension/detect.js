// ══════════════════════════════════════════════════════════════════════
// SEUL module couplé au DOM d'Instagram. Quand Instagram change son front,
// c'est ICI (et uniquement ici) qu'on répare. Chaque fonction essaie ses
// stratégies de la plus stable (URL, ARIA) à la plus fragile (arborescence),
// et rend null sans jamais jeter.
// Script classique (pas un module ES) : content scripts MV3 en scope partagé.
// ══════════════════════════════════════════════════════════════════════

// `var` et garde de réinjection : après un rechargement de l'extension, ce
// fichier peut être ré-injecté dans une page qui l'a déjà exécuté — un `const`
// y jetterait « NMFDetect has already been declared » et tuerait l'injection.
var NMFDetect = typeof NMFDetect !== "undefined" ? NMFDetect : (() => {
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

  /**
   * Pseudos candidats du document, par nombre d'occurrences.
   *
   * Ne s'appuie QUE sur les liens de profil (`/pseudo/`) : c'est la seule
   * source indépendante de la langue de l'interface. Les textes alternatifs
   * d'avatar valent « Photo de profil de <pseudo> » en français mais
   * « <Nom Complet>'s profile picture » en anglais — le nom complet n'est pas
   * un pseudo, on ne peut pas en tirer d'identifiant fiable.
   */
  function candidateUsernames(doc, exclude) {
    const counts = new Map();
    for (const a of doc.querySelectorAll("a[href]")) {
      const u = usernameFromHref(a.getAttribute("href"));
      if (!u || u === exclude) continue;
      counts.set(u, (counts.get(u) || 0) + 1);
    }
    return counts;
  }

  /** Candidat strictement majoritaire, ou null si personne ne se détache. */
  function topCandidate(counts) {
    let best = null;
    let bestN = 0;
    let tie = false;
    for (const [u, n] of counts) {
      if (n > bestN) { best = u; bestN = n; tie = false; }
      else if (n === bestN) tie = true;
    }
    return tie ? null : best;
  }

  /**
   * Pseudo du profil ou de la conversation ouverte.
   * `opts.exclude` : le compte connecté, à ne jamais confondre avec le prospect.
   */
  function currentUsername(loc, doc, opts = {}) {
    try {
      const exclude = opts.exclude ? String(opts.exclude).toLowerCase() : null;
      const path = loc.pathname;
      // 1. Page profil : le pseudo est dans l'URL — la stratégie la plus stable.
      const direct = usernameFromHref(path);
      if (direct) return direct;
      if (!/^\/direct\//.test(path)) return null;

      // 2. Conversation : lien de profil dans le header, quand il existe.
      const header = doc.querySelector("header");
      if (header) {
        for (const a of header.querySelectorAll("a[href]")) {
          const u = usernameFromHref(a.getAttribute("href"));
          if (u && u !== exclude) return u;
        }
      }
      // 3. Repli : vote sur les liens de profil de la page. Dans une
      //    conversation ouverte, le pseudo de l'interlocuteur revient
      //    plusieurs fois (en-tête, carte de profil, « Voir profil ») là où
      //    la liste de gauche ne contient que des liens /direct/t/…, qui ne
      //    sont pas des profils. Égalité = aucune certitude = null.
      return topCandidate(candidateUsernames(doc, exclude));
    } catch {
      return null;
    }
  }

  /**
   * Écrit `text` dans le composer, en remplaçant tout ce qu'il contient.
   * Rend `true` seulement si le champ contient VRAIMENT le texte après coup.
   *
   * Trois stratégies, parce qu'aucune ne marche partout :
   *  1. execCommand — le chemin normal, mais il exige que le DOCUMENT ait le
   *     focus. Depuis le side panel, ce n'est pas le cas : la commande échoue
   *     sans rien dire, et c'est exactement le bug « Corrigé ✓ » sans effet.
   *  2. un événement `paste` synthétique — l'éditeur d'Instagram (Lexical)
   *     écoute le collage, qui ne dépend pas du focus du document.
   *  3. écriture directe + événements d'édition — dernier recours.
   */
  function insertIntoComposer(node, text, opts = {}) {
    if (!node) return false;
    const win = opts.win || (typeof window !== "undefined" ? window : null);
    const doc = node.ownerDocument;
    const reached = () => (node.textContent || "").trim() === String(text).trim();

    const selectAll = () => {
      try {
        const sel = win && win.getSelection ? win.getSelection() : null;
        if (!sel || !doc.createRange) return;
        sel.removeAllRanges();
        const range = doc.createRange();
        range.selectNodeContents(node);
        sel.addRange(range);
      } catch { /* pas de sélection : les stratégies suivantes s'en passent */ }
    };

    try { node.focus(); } catch { /* focus refusé : on tente quand même */ }

    // 1. execCommand
    try {
      selectAll();
      if (doc.execCommand && doc.execCommand("insertText", false, text) && reached()) return true;
    } catch { /* stratégie suivante */ }

    // 2. Collage synthétique
    try {
      if (win && typeof win.DataTransfer === "function" && typeof win.ClipboardEvent === "function") {
        selectAll();
        const dt = new win.DataTransfer();
        dt.setData("text/plain", text);
        node.dispatchEvent(new win.ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
        if (reached()) return true;
      }
    } catch { /* stratégie suivante */ }

    // 3. Écriture directe + événements d'édition
    try {
      node.textContent = text;
      if (win && typeof win.InputEvent === "function") {
        node.dispatchEvent(new win.InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      } else if (typeof Event === "function") {
        node.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return reached();
    } catch {
      return false;
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
   * `opts.strict` : ne garde que les sources qui ne peuvent PAS désigner un
   * tiers (nav, JSON). Sert à obtenir le compte connecté avant même de savoir
   * qui est le prospect — sinon les deux détections s'excluent en rond.
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
      return opts.strict ? null : ok(fromAvatarLinks(doc));
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

  return {
    currentUsername, composerNode, loggedInAccount, watchSend,
    usernameFromHref, lastIncomingText, conversationThread, insertIntoComposer,
  };
})();

// Export de test (node) — inerte dans le navigateur.
if (typeof module !== "undefined") module.exports = NMFDetect;
