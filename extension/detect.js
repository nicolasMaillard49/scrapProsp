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
  async function insertIntoComposer(node, text, opts = {}) {
    if (!node) return false;
    const win = opts.win || (typeof window !== "undefined" ? window : null);
    const doc = node.ownerDocument;
    const settle = opts.settleMs ?? 60;
    const target = String(text);
    const wait = (ms) => new Promise((r) => ((win && win.setTimeout) || setTimeout)(r, ms));
    const isEmpty = () => (node.textContent || "").trim() === "";
    const reached = () => (node.textContent || "").trim() === target.trim();

    // selectAll via le pipeline d'édition d'abord : Lexical suit sa propre
    // sélection, une Range posée de l'extérieur lui échappe souvent.
    const selectAll = () => {
      try { if (doc.execCommand && doc.execCommand("selectAll")) return true; } catch { /* repli */ }
      try {
        const sel = win && win.getSelection ? win.getSelection() : null;
        if (!sel || !doc.createRange) return false;
        sel.removeAllRanges();
        const range = doc.createRange();
        range.selectNodeContents(node);
        sel.addRange(range);
        return true;
      } catch { return false; }
    };

    try { node.focus(); } catch { /* focus refusé : on tente quand même */ }

    // 1. VIDER, et vérifier que c'est vide.
    //    Invariant : on n'écrit JAMAIS dans un champ non vide. Sans lui, une
    //    sélection qui échoue fait ajouter le texte À LA SUITE de l'existant —
    //    c'est ce qui collait la correction deux fois derrière le message.
    if (!isEmpty()) {
      selectAll();
      try { if (doc.execCommand) doc.execCommand("delete"); } catch { /* repli en dessous */ }
      await wait(settle);
      if (!isEmpty()) {
        selectAll();
        try { if (doc.execCommand) doc.execCommand("insertText", false, ""); } catch { /* dernier essai */ }
        await wait(settle);
      }
      // Toujours pas vide : on renonce, champ intact. Mieux vaut ne rien faire
      // que doubler le message.
      if (!isEmpty()) return false;
    }

    // 2. Écrire — une seule fois, dans un champ vide.
    try { if (doc.execCommand) doc.execCommand("insertText", false, target); } catch { /* repli en dessous */ }
    await wait(settle);
    if (reached()) return true;

    // 3. Collage synthétique, uniquement si le champ est resté vide : Lexical
    //    écoute le collage, qui ne dépend pas du focus du document.
    if (isEmpty() && win && typeof win.DataTransfer === "function" && typeof win.ClipboardEvent === "function") {
      try {
        selectAll();
        const dt = new win.DataTransfer();
        dt.setData("text/plain", target);
        node.dispatchEvent(new win.ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
        await wait(settle);
      } catch { /* on rend le verdict ci-dessous */ }
    }
    return reached();
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

  /** Bouton du profil qui ouvre une première conversation, jamais « Envoyer ». */
  function contactButton(doc) {
    try {
      const candidates = [...doc.querySelectorAll('button, [role="button"]')].map((el) => ({
        el,
        label: (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase(),
      }));
      // Sur le profil observé, « Contacter » est le sas nécessaire avant que
      // la conversation existe. Il prime donc même si « Message » apparaît
      // ailleurs dans le DOM (menu, navigation ou autre action secondaire).
      for (const wanted of ["contacter", "contact", "message", "envoyer un message", "send message"]) {
        const hit = candidates.find((candidate) => candidate.label === wanted);
        if (hit) return hit.el;
      }
      return null;
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
  /**
   * Pseudo affiché en titre du sélecteur de compte, en haut de la messagerie.
   *
   * Confirmé par un second signal : ce pseudo doit aussi porter un avatar
   * quelque part dans la page (« Photo de profil de <pseudo> » en français,
   * « <pseudo>'s profile picture » en anglais — la sous-chaîne suffit dans
   * les deux cas). Sans cette confirmation, le nom d'un tiers affiché en
   * titre pourrait passer pour le compte connecté.
   */
  function accountFromHeading(doc) {
    const alts = Array.from(doc.querySelectorAll("img[alt]")).map((i) => (i.getAttribute("alt") || "").toLowerCase());
    for (const h of doc.querySelectorAll("h1, h2")) {
      const t = (h.textContent || "").trim().toLowerCase();
      if (!/^[a-z0-9._]{2,30}$/.test(t) || RESERVED.has(t)) continue;
      if (alts.some((a) => a.includes(t))) return t;
    }
    return null;
  }

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

      // 2. En-tête du sélecteur de compte de la messagerie : un titre dont le
      //    texte EST un pseudo. Vérifié sur le DOM réel de /direct/, où la nav
      //    est réduite à des icônes sans avatar.
      const fromHeading = ok(accountFromHeading(doc));
      if (fromHeading) return fromHeading;

      // 3. JSON embarqué, quand Instagram l'expose encore.
      const fromJson = ok(viewerFromScripts(doc));
      if (fromJson) return fromJson;

      // 4. Dernier repli : tout le document, en excluant la conversation.
      return opts.strict ? null : ok(fromAvatarLinks(doc));
    } catch {
      return null;
    }
  }

  /** Lignes de service d'un fil (accusés, horodatages) — pas des messages. */
  const NOISE = /^(vu|seen|envoyé|sent|remis|delivered|modifié|edited|aujourd'hui|today|hier|yesterday|maintenant|now|\d{1,2}:\d{2}|\d{1,2}\s*\w+\s*\d{2,4}|\d+\s*(min|h|j|m|d)|·)$/i;
  /** Instagram étiquette parfois les messages sortants dans le nom accessible. */
  const OWN_LABEL = /vous avez envoyé|vous avez répondu|you sent|you replied/i;
  /**
   * Carte de profil affichée en tête de conversation (« pseudo · Instagram »,
   * « Voir le profil ») : elle est DANS le fil mais n'est pas un message.
   */
  const CARD_NOISE = /·\s*instagram$|^voir (le )?profil$|^view profile$|^[a-z0-9._]{2,30}$/i;

  /**
   * Conteneur défilant de la conversation ouverte.
   *
   * Indispensable : la barre latérale liste les AUTRES conversations avec un
   * aperçu de leur dernier message. Lire le fil sur tout le document y mêlait
   * des bouts de conversations qui n'ont rien à voir.
   * On retient le plus grand conteneur défilant — le volet de conversation est
   * bien plus large que la liste de gauche.
   *
   * On ne demande PAS qu'il déborde à cet instant. C'était la cause du bug du
   * 04/08 : mesuré sur la vraie page, le volet ouvert est bien un conteneur
   * défilant (`overflow-y: scroll`, 1561 px) mais `scrollHeight === clientHeight`
   * tant que la conversation tient à l'écran. La liste de gauche, elle, déborde
   * toujours — elle restait donc seule candidate, et l'IA recevait les aperçus
   * d'une dizaine de prospects au lieu du fil. Autrement dit, la lecture ne
   * marchait que sur les conversations assez longues pour défiler.
   * Être défilant PAR NATURE est stable ; déborder ne l'est pas.
   */
  function messageScroller(doc, win, opts = {}) {
    const rectOf = opts.rectOf || ((el) => el.getBoundingClientRect());
    const cands = [];
    let scanned = 0;
    for (const el of doc.querySelectorAll("div")) {
      if (++scanned > 3000) break;
      const cs = win && win.getComputedStyle ? win.getComputedStyle(el) : null;
      if (!cs || (cs.overflowY !== "auto" && cs.overflowY !== "scroll")) continue;
      const r = rectOf(el);
      const w = r.width || 0;
      if (w <= 300) continue;
      cands.push({ el, area: w * (r.height || 0) });
    }
    // Un conteneur qui en enveloppe un autre englobe les deux volets : le
    // retenir ramènerait la liste de gauche par la fenêtre. On ne garde que les
    // volets eux-mêmes, et parmi eux le plus grand.
    const volets = cands.filter((c) => !cands.some((o) => o !== c && c.el.contains(o.el)));
    let best = null;
    let bestArea = 0;
    for (const c of volets) {
      if (c.area > bestArea) {
        best = c.el;
        bestArea = c.area;
      }
    }
    return best;
  }

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
      const maxRows = opts.maxRows ?? 60;
      const win = opts.win || (typeof window !== "undefined" ? window : null);
      const rectOf = opts.rectOf || ((el) => el.getBoundingClientRect());

      // Périmètre : le volet de conversation, jamais tout le document.
      // Aucun volet reconnu → on ne rend RIEN. Le repli sur `document.body`
      // ramenait la barre latérale et fabriquait un fil crédible mais faux :
      // l'IA le refusait (« ce fil mélange plusieurs conversations ») sans que
      // rien n'indique d'où venait le mélange. Un tableau vide, lui, fait dire
      // au panneau « fil illisible sur cette page » — la vérité, et un geste.
      const scope = opts.scope || messageScroller(doc, win, { rectOf });
      if (!scope) return [];
      const box = scope.getBoundingClientRect ? rectOf(scope) : null;

      // Chaque message est un span[dir="auto"] feuille. `div[role="row"]`,
      // sur lequel reposait la version précédente, n'existe pas dans le DOM
      // d'Instagram — vérifié sur une vraie conversation : zéro occurrence.
      const spans = Array.from(scope.querySelectorAll('span[dir="auto"]'));
      const out = [];
      for (const el of spans) {
        if (el.querySelector('span[dir="auto"]')) continue; // garder la feuille
        const text = (el.innerText || el.textContent || "").trim();
        if (!text || NOISE.test(text) || CARD_NOISE.test(text)) continue;

        let from = "?";
        // 1. Étiquette accessible, quand Instagram en pose une.
        for (let p = el, i = 0; p && i < 6; p = p.parentElement, i++) {
          if (OWN_LABEL.test(p.getAttribute && (p.getAttribute("aria-label") || ""))) { from = "moi"; break; }
        }

        // 2. Géométrie : les messages sortants sont alignés à DROITE du volet,
        //    les entrants à gauche. Mesuré sur une vraie conversation : 0.84 à
        //    0.90 pour les sortants, 0.07 à 0.12 pour les entrants. Aucune
        //    dépendance à la langue ni à une classe obfusquée.
        if (from === "?" && box && box.width > 0) {
          const r = rectOf(el);
          const rel = (r.left + r.width / 2 - box.left) / box.width;
          if (rel > 0.55) from = "moi";
          else if (rel < 0.45) from = "lui";
        }

        // Un message rendu en plusieurs spans ne compte qu'une fois.
        const last = out[out.length - 1];
        if (last && last.text === text && last.from === from) continue;
        out.push({ from, text: text.slice(0, 1000) });
      }
      return out.slice(Math.max(0, out.length - maxRows));
    } catch {
      return [];
    }
  }

  /** Aperçu d'une conversation où c'est NOUS qui avons parlé en dernier. */
  const MINE_PREFIX = /^(vous|you)\s*:/i;
  /** Lignes d'événement : ce n'est pas un message en attente de réponse. */
  const EVENT_PREVIEW = /^(a aimé|liked|a réagi|reacted|vous avez|you )/i;
  /**
   * Avis d'Instagram lui-même (compte fermé aux DM, demande en attente…).
   * Vérifié sur la vraie boîte : sans ce filtre, le radar annonçait une
   * réponse là où personne n'avait écrit.
   */
  const SYSTEM_PREVIEW = /ne peut pas recevoir|can'?t receive|n'autorise pas|does ?n'?t allow|demande de message|message request/i;

  /**
   * Conversations où le prospect a parlé en DERNIER — donc celles qui
   * attendent une réponse.
   *
   * Instagram n'offre aucune vue de ce genre : la liste mélange tout, et rien
   * ne distingue « il attend » de « j'attends ». L'aperçu, lui, est préfixé de
   * « Vous : » quand c'est nous qui avons écrit en dernier.
   */
  function inboxRows(doc, opts = {}) {
    const rectOf = opts.rectOf || ((el) => el.getBoundingClientRect());
    const seen = new Set();
    const cand = [];
    let scanned = 0;
    for (const d of doc.querySelectorAll("div")) {
      if (++scanned > 6000) break;
      // Signature d'une ligne de conversation, relevée sur le DOM réel :
      // exactement un avatar, et deux à cinq lignes de texte.
      if (d.querySelectorAll("img").length !== 1) continue;
      const t = (d.textContent || "").trim();
      if (!t || seen.has(t)) continue;
      // Les lignes viennent des nœuds FEUILLES, pas des retours à la ligne de
      // `innerText` : ceux-ci dépendent de la mise en page rendue, absente
      // hors navigateur et susceptible de changer sans prévenir.
      const lines = Array.from(d.querySelectorAll("span, div"))
        .filter((e) => e.children.length === 0)
        .map((e) => (e.textContent || "").trim())
        .filter(Boolean);
      if (lines.length < 2 || lines.length > 5) continue;
      seen.add(t);
      cand.push({ el: d, lines, h: Math.round(rectOf(d).height) });
    }
    // Les lignes de conversation ont toutes la MÊME hauteur ; ce qui dépasse
    // est autre chose (le bloc des notes, une bannière…).
    const byHeight = new Map();
    for (const c of cand) byHeight.set(c.h, (byHeight.get(c.h) || 0) + 1);
    let modal = null;
    let best = 0;
    for (const [h, n] of byHeight) if (n > best) { best = n; modal = h; }
    return best >= 2 ? cand.filter((c) => c.h === modal) : cand;
  }

  function inboxWaiting(doc, opts = {}) {
    try {
      const max = opts.max ?? 40;
      const out = [];
      inboxRows(doc, opts).forEach((row, index) => {
        if (out.length >= max) return;
        const [name, preview = ""] = row.lines;
        if (!name || !preview) return;
        if (MINE_PREFIX.test(preview) || EVENT_PREVIEW.test(preview) || SYSTEM_PREVIEW.test(preview)) return;
        out.push({ index, name, preview: preview.slice(0, 120) });
      });
      return out;
    } catch {
      return [];
    }
  }

  /**
   * Ouvre la conversation de rang `index` (tel que rendu par `inboxWaiting`).
   * Un clic pour NAVIGUER, jamais pour envoyer : l'invariant « l'humain
   * envoie » reste entier.
   */
  function openInboxRow(doc, index, opts = {}) {
    const rows = inboxRows(doc, opts);
    const row = rows[index];
    if (!row) return false;
    row.el.click();
    return true;
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

  /* ────────────────────────────────────────────────────────────
   * Ce que la page du profil raconte — matiere de l'accroche vivante.
   *
   * La trame envoie le meme M1 a tout le monde. Or le taux de reponse a froid
   * se joue entierement sur la premiere ligne : « vu votre realisation de la
   * semaine derniere » n'est pas de la politesse, c'est la preuve qu'un humain
   * a regarde. A la main c'est tenable sur 5 prospects par jour ; sur 50 il
   * faut lire la page.
   *
   * On ne lit QUE du texte deja affiche a l'ecran : la bio, et les
   * descriptions alternatives des vignettes (qu'Instagram remplit lui-meme).
   * Aucune requete, aucune API privee, aucun scroll provoque.
   * ──────────────────────────────────────────────────────────── */

  /** Alt d'Instagram : « Photo par X le 3 juin 2026. Peut contenir : … ». */
  const ALT_PREFIX = /^(photo|image|vidéo|video|reel)[^.]*\.\s*/i;
  const ALT_NOISE = /^(photo de profil|profile picture|.*'s profile picture)/i;

  function profileSnapshot(doc = document, opts = {}) {
    const d = doc || document;
    const main = d.querySelector("main") || d.body;
    if (!main) return { bio: "", posts: [] };

    // La bio vit dans l'en-tete du profil, sous le nom. On prend le plus long
    // bloc de texte de la section d'en-tete : c'est elle, dans toutes les
    // variantes de mise en page qu'Instagram a fait defiler.
    const header = main.querySelector("header") || main;
    let bio = "";
    for (const el of header.querySelectorAll("span, h1, div")) {
      if (el.children.length) continue; // feuilles seulement : pas de doublon parent/enfant
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length > bio.length && t.length <= 400 && !/^\d/.test(t)) bio = t;
    }

    const posts = [];
    for (const img of main.querySelectorAll("img[alt]")) {
      const alt = (img.getAttribute("alt") || "").replace(/\s+/g, " ").trim();
      if (!alt || ALT_NOISE.test(alt)) continue;
      const t = alt.replace(ALT_PREFIX, "").trim();
      if (t.length < 12 || posts.includes(t)) continue;
      posts.push(t.slice(0, 240));
      if (posts.length >= (opts.max ?? 4)) break;
    }
    return { bio: bio.slice(0, 400), posts };
  }

  return {
    currentUsername, composerNode, contactButton, loggedInAccount, watchSend,
    profileSnapshot,
    usernameFromHref, lastIncomingText, conversationThread, insertIntoComposer,
    messageScroller,
    inboxWaiting, openInboxRow,
  };
})();

// Export de test (node) — inerte dans le navigateur.
if (typeof module !== "undefined") module.exports = NMFDetect;
