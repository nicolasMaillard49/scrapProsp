// CRM — logique PURE du dossier client (statuts, progression, saisie).
//
// Ce fichier ne parle jamais à Supabase : tout ce qu'il contient se teste sans
// base et se réutilise côté serveur comme côté écran. Les routes `/api/crm/*`
// s'en servent pour VALIDER ce qui entre, la page `/crm` pour AFFICHER.
//
// La frontière avec le pipeline Instagram (`igPipeline.ts`) est nette :
//  - le prospect a un STADE de tunnel, qui va de l'accroche au call booké ;
//  - le client a un AVANCEMENT DE MISSION, qui commence là où le tunnel finit.
// Un dossier client n'a donc pas de « stade » et un prospect n'a pas de
// « checklist » — les confondre remettrait de la prospection dans un dossier
// facturé.

/* ────────────────────────────────────────────────────────────
 * Statuts
 * ──────────────────────────────────────────────────────────── */

/**
 * Le cycle de vie d'un dossier, dans l'ordre.
 *
 * `en_attente` n'est pas un ornement : en agence, un dossier bloqué l'est
 * presque toujours du côté du CLIENT (accès Google en retard, contenus non
 * fournis, validation qui traîne). Sans ce statut, ces dossiers restent
 * « en cours » et l'écran ment sur ce qui dépend encore de nous.
 */
export const CLIENT_STATUSES = [
  "piste",
  "en_cours",
  "en_attente",
  "livre",
  "termine",
  "perdu",
] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  piste: "Piste",
  en_cours: "En cours",
  en_attente: "En attente client",
  livre: "Livré",
  termine: "Terminé",
  perdu: "Perdu",
};

/** Ce que chaque statut veut dire — affiché sous le sélecteur, pour ne pas avoir à s'en souvenir. */
export const CLIENT_STATUS_HINT: Record<ClientStatus, string> = {
  piste: "Il a dit oui, rien n'est encore engagé.",
  en_cours: "La mission tourne, la balle est chez nous.",
  en_attente: "Bloqué de son côté — accès, contenus, validation.",
  livre: "Livré et en observation : on mesure, on ajuste.",
  termine: "Clos et facturé.",
  perdu: "N'a pas donné suite.",
};

/** Teinte SÉMANTIQUE (l'UI mappe ces clés vers des classes). Même axe que `stageTone`. */
export type ClientTone = "todo" | "progress" | "wait" | "warm" | "won" | "lost";
export function clientTone(statut: string): ClientTone {
  switch (statut) {
    case "piste":
      return "todo";
    case "en_cours":
      return "progress";
    case "en_attente":
      return "wait";
    case "livre":
      return "warm";
    case "termine":
      return "won";
    case "perdu":
      return "lost";
    default:
      return "progress";
  }
}

/** Les statuts qui FERMENT le dossier — ils datent `closed_at` et sortent des « actifs ». */
export function isClosed(statut: string): boolean {
  return statut === "termine" || statut === "perdu";
}

/**
 * Le dossier compte-t-il dans le chiffre d'affaires ENGAGÉ ?
 *
 * Une piste, non : il a dit oui à un audit, pas à un devis. Compter les pistes
 * gonflerait le CA d'un espoir — c'est exactement l'erreur qu'on a corrigée sur
 * les KPI Instagram (compter des messages pour des prises de contact).
 * Un dossier perdu, non plus. Tout le reste est du travail réellement engagé.
 */
export function countsAsRevenue(statut: string): boolean {
  return statut === "en_cours" || statut === "en_attente" || statut === "livre" || statut === "termine";
}

/** Valide une chaîne venue du réseau. `null` si ce n'est pas un statut connu. */
export function parseClientStatus(raw: unknown): ClientStatus | null {
  const s = String(raw ?? "").toLowerCase().trim();
  return (CLIENT_STATUSES as readonly string[]).includes(s) ? (s as ClientStatus) : null;
}

/* ────────────────────────────────────────────────────────────
 * Journal
 * ──────────────────────────────────────────────────────────── */

/**
 * Les genres d'entrée du journal.
 *
 * Le genre n'est pas décoratif : relire un dossier six mois plus tard, c'est
 * chercher « qu'est-ce qu'on s'est DIT au téléphone », pas « qu'est-ce que
 * j'avais noté ». Un journal sans genre oblige à tout relire.
 */
export const NOTE_KINDS = ["note", "appel", "email", "reunion", "livraison", "paiement"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  note: "Note",
  appel: "Appel",
  email: "Email",
  reunion: "Réunion",
  livraison: "Livraison",
  paiement: "Paiement",
};

export function parseNoteKind(raw: unknown): NoteKind | null {
  const s = String(raw ?? "note").toLowerCase().trim();
  return (NOTE_KINDS as readonly string[]).includes(s) ? (s as NoteKind) : null;
}

/* ────────────────────────────────────────────────────────────
 * Colonnes servies
 * ──────────────────────────────────────────────────────────── */

// Une seule liste par table, lue par toutes les routes. Deux `select()` qui
// divergent, c'est un champ présent sur la liste et absent de la fiche — le
// genre d'écart qu'on ne voit qu'à l'écran, jamais à la compilation.
//
// Ces constantes vivent ICI et non dans les routes : un fichier `route.ts`
// n'admet aucun export en dehors des verbes HTTP (le build Next échoue sur
// « Property … is incompatible with index signature »).

export const CLIENT_COLS =
  "id, nom, contact, email, telephone, site_url, image_url, metier, ville, description, statut, source, tarif_ht, maintenance_ht, maintenance_day, recurrent, started_at, closed_at, instagram_prospect_id, created_at, updated_at";

export const INVOICE_COLS = "id, client_id, periode, numero, libelle, montant_ht, due_date, paid_at, created_at";

export const SERVICE_COLS = "id, client_id, code, label, montant_ht, created_at";

export const DOCUMENT_COLS = "id, client_id, path, nom, mime, taille, kind, created_at";

export const TASK_COLS = "id, client_id, label, details, phase, rank, done, done_at, due_date, created_at";

export const NOTE_COLS = "id, client_id, body, kind, at, created_at";

/* ────────────────────────────────────────────────────────────
 * Progression
 * ──────────────────────────────────────────────────────────── */

export interface Progress {
  done: number;
  total: number;
  /** 0-100, entier. `0` quand il n'y a aucune étape — surtout pas 100. */
  pct: number;
}

/**
 * L'avancement d'une checklist.
 *
 * Un dossier SANS étape est à 0 %, jamais à 100 % : un dossier vide n'est pas
 * un dossier fini, et une barre pleine sur une checklist vide ferait croire à
 * une mission livrée. C'est le seul cas qui mérite d'être écrit.
 */
export function progress(tasks: { done: boolean }[]): Progress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Rang à donner à une nouvelle étape : à la suite, jamais au milieu. */
export function nextRank(tasks: { rank: number }[]): number {
  return tasks.reduce((max, t) => Math.max(max, t.rank), -1) + 1;
}

/* ────────────────────────────────────────────────────────────
 * Ce qu'une carte doit dire sans qu'on l'ouvre
 * ──────────────────────────────────────────────────────────── */

/**
 * La PROCHAINE étape à faire : la première non cochée, dans l'ordre des rangs.
 *
 * Une barre de progression dit où on en est, jamais ce qu'il reste à faire.
 * C'est la question qu'on se pose en ouvrant un CRM, et y répondre sur la carte
 * évite d'ouvrir six dossiers pour retrouver le seul geste en attente.
 */
export function nextAction(tasks: { label: string; rank: number; done: boolean }[]): string | null {
  const reste = tasks.filter((t) => !t.done).sort((a, b) => a.rank - b.rank);
  return reste.length ? reste[0].label : null;
}

/** La plus récente de plusieurs dates, en ISO — les vides et les invalides sont ignorées. */
export function lastActivityAt(dates: (string | null | undefined)[]): string | null {
  let best: number | null = null;
  let iso: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    if (best === null || t > best) { best = t; iso = d; }
  }
  return iso;
}

/** Jours pleins écoulés depuis une date. `null` si la date est absente ou fausse. */
export function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/**
 * Au-delà de dix jours sans le moindre geste, un dossier ACTIF a décroché.
 *
 * Le seuil ne s'applique jamais à un dossier clos (terminé, perdu) : un dossier
 * fini est immobile par nature, le signaler comme oublié serait du bruit.
 */
export const STALE_DAYS = 10;

export function isStale(statut: string, iso: string | null | undefined, now: Date): boolean {
  if (isClosed(statut)) return false;
  const j = daysSince(iso, now);
  return j !== null && j > STALE_DAYS;
}

/** « aujourd'hui », « hier », « il y a 6 j », « il y a 3 sem. », « il y a 4 mois ». */
export function relativeFr(iso: string | null | undefined, now: Date): string {
  const j = daysSince(iso, now);
  if (j === null) return "—";
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return "hier";
  if (j < 14) return `il y a ${j} j`;
  if (j < 60) return `il y a ${Math.round(j / 7)} sem.`;
  return `il y a ${Math.round(j / 30)} mois`;
}

/**
 * Les dossiers rangés par statut, dans l'ordre du cycle de vie.
 *
 * TOUTES les colonnes sont rendues, même vides : une colonne absente ne se
 * survole pas, et un tableau où l'on ne peut pas déposer « Livré » tant que
 * personne n'y est n'est pas un tableau.
 */
export function groupByStatus<T extends { statut: string }>(rows: T[]): { statut: ClientStatus; rows: T[] }[] {
  return CLIENT_STATUSES.map((s) => ({ statut: s, rows: rows.filter((r) => parseClientStatus(r.statut) === s) }));
}

/** Somme des tarifs d'une colonne — ce que cette étape du cycle représente. */
export function sumTarif(rows: { tarif_ht?: number | string | null }[]): number {
  return rows.reduce((n, r) => n + (parseTarif(r.tarif_ht) ?? 0), 0);
}

/* ────────────────────────────────────────────────────────────
 * Saisie
 * ──────────────────────────────────────────────────────────── */

/**
 * Transforme un COLLAGE en étapes — le geste central du CRM.
 *
 * La checklist ne se tape pas ici : elle sort d'un échange avec l'IA, sous la
 * forme d'une liste à puces. On la colle telle quelle, avec ses `-`, ses `1.`,
 * ses `[ ]`, ses `**gras**` et ses émojis de tête, et chaque ligne devient une
 * étape. Exiger une saisie propre reviendrait à faire retaper à la main ce qui
 * existe déjà — et donc à ne pas s'en servir.
 *
 * Les titres de section markdown (`## Cadrage`) sont RETIRÉS : ce ne sont pas
 * des étapes. Le regroupement se fait par `phase`, pas par de fausses lignes.
 */
export function parseChecklistPaste(raw: string): string[] {
  const out: string[] = [];
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    let s = line.trim();
    if (!s) continue;
    // Titres markdown : une section, pas une tâche.
    if (/^#{1,6}\s/.test(s)) continue;
    // Séparateurs (`---`, `***`, `___`).
    if (/^([-*_]\s*){3,}$/.test(s)) continue;
    // Puces et numérotations de tête : `- `, `* `, `• `, `1. `, `1) `, `a) `.
    s = s.replace(/^[-*•·–—]\s+/, "").replace(/^\(?[0-9]{1,3}[.)]\s+/, "").replace(/^[a-z][.)]\s+/i, "");
    // Case à cocher déjà présente, cochée ou non — l'état vient de la base.
    s = s.replace(/^\[[ xX✓]?\]\s*/, "").replace(/^[☐☑✅❌]\s*/, "");
    // Emphase markdown : on garde le texte, pas les étoiles.
    s = s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
    s = s.trim().replace(/[:;,]$/, "");
    if (s.length < 2) continue;
    out.push(s);
  }
  return out;
}

/**
 * Rend une URL cliquable, ou `null`.
 *
 * Un site saisi « nmf-agence.com » sans schéma produit un lien RELATIF que le
 * navigateur résout en `/crm/<id>/nmf-agence.com` — le clic reste dans l'app et
 * le lien semble mort sans rien dire.
 */
export function normalizeUrl(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(s)) return `https://${s.replace(/^\/+/, "")}`;
  return null;
}

/**
 * Message affichable depuis le corps d'une réponse en échec, quel qu'il soit.
 *
 * Nos routes répondent `{ error: "..." }`, une CHAÎNE. Mais entre l'écran et
 * elles il peut y avoir autre chose : un proxy, un pare-feu, ou — vu en dev —
 * le serveur d'un projet voisin qui capte le port et renvoie
 * `{ error: { code, message, correlationId } }`. Passé tel quel à React, cet
 * objet ne s'affiche pas : il fait tomber la page entière, et l'incident
 * réseau devient un écran blanc.
 */
export function messageErreur(payload: unknown, status: number): string {
  const repli = `Erreur ${status}`;
  const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

  if (texte(payload)) return texte(payload)!;
  if (!payload || typeof payload !== "object") return repli;

  const err = (payload as { error?: unknown }).error;
  return (
    texte(err) ??
    texte((err as { message?: unknown } | null)?.message) ??
    texte((payload as { message?: unknown }).message) ??
    repli
  );
}

/**
 * Le lien « discuter sur WhatsApp » depuis un numéro saisi à la française.
 *
 * `wa.me` n'accepte QUE le format international sans `+` : « 06 18 96 57 36 »
 * tel quel ouvre une conversation avec un numéro inexistant, sans erreur —
 * l'écran a l'air de marcher et le message ne part jamais. Le 0 de tête est
 * donc remplacé par l'indicatif pays (33 par défaut, la clientèle est française).
 *
 * `null` dès que le numéro n'a pas la bonne longueur : un lien mort vaut moins
 * qu'un lien absent, qui au moins se voit.
 */
export function waLink(telephone: unknown, pays = "33"): string | null {
  const brut = String(telephone ?? "").trim();
  if (!brut) return null;

  const international = brut.startsWith("+") || brut.startsWith("00");
  const chiffres = brut.replace(/\D/g, "").replace(/^00/, "");
  if (!chiffres) return null;

  let n = chiffres;
  if (!international && n.startsWith("0")) n = pays + n.slice(1);
  // 8 chiffres après l'indicatif au minimum : en dessous c'est un numéro court
  // ou une saisie tronquée, pas un mobile.
  if (n.length < 10 || n.length > 15) return null;
  return `https://wa.me/${n}`;
}

/**
 * Deux valeurs disent-elles LA MÊME CHOSE ?
 *
 * `+33 6 18 96 57 36` et `06 18 96 57 36` sont le même numéro ;
 * `https://gp-elec-49.com/` et `https://gp-elec-49.com` le même site. Les
 * signaler comme divergents à chaque récupération d'infos noierait les vraies
 * différences — et une alerte qu'on apprend à ignorer ne sert plus à rien.
 */
export function memeValeur(champ: string, a: unknown, b: unknown): boolean {
  const x = String(a ?? "").trim();
  const y = String(b ?? "").trim();
  if (!x || !y) return x === y;

  if (champ === "telephone") {
    const num = (s: string) => s.replace(/\D/g, "").replace(/^00/, "").replace(/^33/, "0").replace(/^0+/, "0");
    return num(x) === num(y);
  }
  if (champ === "site_url") {
    const url = (s: string) => s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
    return url(x) === url(y);
  }
  if (champ === "email") return x.toLowerCase() === y.toLowerCase();
  return x.toLowerCase().replace(/\s+/g, " ") === y.toLowerCase().replace(/\s+/g, " ");
}

/** Champ texte : la chaîne nettoyée, ou `null` — jamais `""` (qui affiche un vide occupé). */
export function cleanText(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Tarif en euros HT depuis une saisie humaine : « 500 », « 500 €», « 1 200,50 ».
 * `null` si ce n'est pas un nombre — un tarif faux est pire qu'un tarif absent.
 */
export function parseTarif(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : null;
  const s = String(raw)
    .replace(/[€\s ]/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* ────────────────────────────────────────────────────────────
 * Supervision : ce qui vit APRÈS la livraison
 * ──────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────
 * Pièces du dossier
 * ──────────────────────────────────────────────────────────── */

export const DOC_KINDS = ["audit", "bilan", "devis", "facture", "image", "autre"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  audit: "Audit",
  bilan: "Bilan",
  devis: "Devis",
  facture: "Facture",
  image: "Image",
  autre: "Autre",
};

/** Genre de pièce, ou `null` — un genre inventé rendrait le filtre menteur. */
export function parseDocKind(raw: unknown): DocKind {
  const s = String(raw ?? "").trim().toLowerCase();
  return (DOC_KINDS as readonly string[]).includes(s) ? (s as DocKind) : "autre";
}

export interface ClientDocument {
  id: string;
  client_id: string;
  /** Chemin dans le bucket privé. Le lien de lecture est signé à la demande. */
  path: string;
  nom: string;
  mime: string | null;
  taille: number | null;
  kind: string;
  created_at?: string;
  /** Lien signé, ajouté à la lecture — jamais stocké (il expire). */
  url?: string | null;
}

/** Poids lisible : « 2,4 Mo », « 812 Ko ». */
export function poidsFr(octets: number | null | undefined): string {
  if (octets === null || octets === undefined || !Number.isFinite(octets)) return "—";
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Une prestation vendue : le code sert à COMPTER, le libellé et le montant sont figés à la vente. */
export interface ClientService {
  id: string;
  client_id: string;
  code: string;
  label: string;
  montant_ht: number | string | null;
  created_at?: string;
}

export interface Invoice {
  id: string;
  client_id: string;
  /** Premier jour du mois couvert (`2026-08-01`). Une période est un MOIS. */
  periode: string;
  numero: string | null;
  libelle: string | null;
  montant_ht: number | string | null;
  due_date: string | null;
  paid_at: string | null;
}

/** `2026-08-01` — le mois de `now`, en date ISO courte, fuseau local. */
export function moisDe(now: Date): string {
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${m}-01`;
}

/** « août 2026 » — un mois se lit, il ne se déchiffre pas. */
export function moisFr(periode: string | null | undefined): string {
  if (!periode) return "—";
  const d = new Date(`${String(periode).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Jour du mois convenu (1-31), ou `null` si la saisie n'en est pas un. */
export function parseJourEcheance(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1 || n > 31) return null;
  return n;
}

/**
 * La date limite d'un mois donné, au jour convenu.
 *
 * Un mois qui n'a pas ce jour-là (le 31 en février) est ramené à son DERNIER
 * jour : une échéance ne glisse pas au mois suivant, elle se rabat sur la fin
 * du mois couvert — sinon février serait payable en mars et le retard
 * deviendrait indécidable.
 *
 * Sans jour convenu, on retombe sur le délai usuel de 30 jours.
 */
export function echeanceDe(periode: string, jour: number | null | undefined): string {
  const base = new Date(`${String(periode).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return String(periode).slice(0, 10);
  if (!jour) return new Date(base.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

  const an = base.getUTCFullYear();
  const mois = base.getUTCMonth();
  const dernier = new Date(Date.UTC(an, mois + 1, 0)).getUTCDate();
  const j = Math.min(jour, dernier);
  return `${an}-${`${mois + 1}`.padStart(2, "0")}-${`${j}`.padStart(2, "0")}`;
}

/**
 * Les `n` derniers mois, du plus ancien au plus récent, mois courant inclus.
 *
 * La frise de paiement affiche TOUS les mois, y compris ceux sans facture : un
 * mois absent est justement celui qu'on a oublié de facturer, et ne pas
 * l'afficher le rendrait invisible.
 */
export function moisPrecedents(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-01`);
  }
  return out;
}

export type EtatFacture = "payee" | "a_echoir" | "en_retard";

/**
 * L'état d'une échéance : payée, à échoir, ou en retard.
 *
 * Le retard se mesure sur la DATE D'ÉCHÉANCE et jamais sur la période : une
 * facture d'août payable au 15 septembre n'est pas en retard le 1er septembre.
 * Sans date d'échéance, on ne peut rien affirmer — donc « à échoir ».
 */
export function etatFacture(inv: { due_date?: string | null; paid_at?: string | null }, now: Date): EtatFacture {
  if (inv.paid_at) return "payee";
  if (!inv.due_date) return "a_echoir";
  const d = new Date(`${String(inv.due_date).slice(0, 10)}T23:59:59`);
  if (Number.isNaN(d.getTime())) return "a_echoir";
  return d.getTime() < now.getTime() ? "en_retard" : "a_echoir";
}

export const ETAT_FACTURE_LABEL: Record<EtatFacture, string> = {
  payee: "Payée",
  a_echoir: "À échoir",
  en_retard: "En retard",
};

/**
 * Un dossier est EN SUPERVISION dès qu'il porte un montant mensuel.
 *
 * Pas « quand il est terminé » : la maintenance d'un site livré court pendant
 * qu'une campagne tourne encore sur le même client. C'est l'argent récurrent
 * qui définit la supervision, pas l'état de la mission.
 */
export function enSupervision(c: { maintenance_ht?: number | string | null }): boolean {
  const m = parseTarif(c.maintenance_ht);
  return m !== null && m > 0;
}

/** Revenu mensuel récurrent : la somme des maintenances, et rien d'autre. */
export function mrr(rows: { maintenance_ht?: number | string | null }[]): number {
  return rows.filter(enSupervision).reduce((n, r) => n + (parseTarif(r.maintenance_ht) ?? 0), 0);
}

export interface SupervisionSummary {
  /** L'échéance du mois en cours, si elle a été émise. */
  courante: Invoice | null;
  /** Échues et non réglées — celles qui se relancent. */
  retards: Invoice[];
  /** Somme HT des retards. */
  duHT: number;
  /** Dernière période encaissée, en ISO. */
  dernierPaiement: string | null;
}

/**
 * Ce qu'il faut savoir d'un client supervisé sans ouvrir sa fiche.
 *
 * « M'a-t-il payé ce mois-ci ? » ne se répond pas de mémoire : l'absence de
 * ligne pour un mois n'est PAS un impayé (la facture n'est peut-être pas
 * émise), et une ligne échue sans `paid_at` en est un. Les deux cas se
 * distinguent ici, une bonne fois.
 */
export function supervisionSummary(invoices: Invoice[], now: Date): SupervisionSummary {
  const mois = moisDe(now);
  const courante = invoices.find((i) => String(i.periode).slice(0, 10) === mois) ?? null;
  const retards = invoices.filter((i) => etatFacture(i, now) === "en_retard");
  const payees = invoices
    .filter((i) => i.paid_at)
    .sort((a, b) => String(b.periode).localeCompare(String(a.periode)));
  return {
    courante,
    retards,
    duHT: retards.reduce((n, i) => n + (parseTarif(i.montant_ht) ?? 0), 0),
    dernierPaiement: payees.length ? String(payees[0].periode).slice(0, 10) : null,
  };
}

/**
 * L'échéance suivante à émettre pour un client supervisé.
 *
 * Le mois COURANT d'abord : une agence facture le mois qu'elle est en train de
 * servir, pas le suivant. Rendre `null` quand il est déjà émis évite le doublon
 * que l'index unique refuserait de toute façon — autant ne pas proposer le geste.
 */
export function prochainePeriode(invoices: Invoice[], now: Date): string | null {
  const mois = moisDe(now);
  return invoices.some((i) => String(i.periode).slice(0, 10) === mois) ? null : mois;
}

/* ────────────────────────────────────────────────────────────
 * Reprise d'un prospect Instagram
 * ──────────────────────────────────────────────────────────── */

export interface ProspectSeed {
  id: string;
  username: string;
  full_name?: string | null;
  metier?: string | null;
  ville?: string | null;
  external_url?: string | null;
  bio?: string | null;
  profile_pic_url?: string | null;
}

export interface ClientDraft {
  nom: string;
  metier: string | null;
  ville: string | null;
  site_url: string | null;
  image_url: string | null;
  description: string;
  source: string;
  instagram_prospect_id: string;
}

/**
 * Pré-remplit un dossier depuis un prospect booké.
 *
 * Le nom d'usage prime sur le pseudo (`full_name` est ce que le client écrit
 * sur ses factures ; `@sonpseudo` est ce qu'Instagram en a fait). On recopie
 * peu et on ne recopie JAMAIS le stade ni les compteurs : le dossier n'hérite
 * pas de la prospection, il lui succède.
 *
 * La photo de profil est reprise pour que la carte du tableau soit RECONNAISSABLE
 * dès la reprise. Ces URL Instagram sont signées et finissent par expirer : ce
 * n'est pas une panne, l'image retombe alors sur l'initiale et le champ « Logo /
 * photo » de la fiche accepte une URL durable.
 */
export function clientFromProspect(p: ProspectSeed): ClientDraft {
  const nom = cleanText(p.full_name) ?? `@${p.username}`;
  return {
    nom,
    metier: cleanText(p.metier),
    ville: cleanText(p.ville),
    site_url: normalizeUrl(p.external_url),
    image_url: normalizeUrl(p.profile_pic_url),
    description: `Prospect Instagram @${p.username} — call booké.`,
    source: "instagram",
    instagram_prospect_id: p.id,
  };
}

/* ────────────────────────────────────────────────────────────
 * Agrégats de la liste
 * ──────────────────────────────────────────────────────────── */

export interface CrmTotals {
  /** Dossiers ouverts (ni terminés ni perdus). */
  actifs: number;
  /** Dossiers en attente d'une action DU CLIENT — la file qu'on relance. */
  bloques: number;
  /** € HT engagés : tout ce qui n'est ni piste ni perdu (cf. `countsAsRevenue`). */
  caEngage: number;
  /** € HT encore à l'état d'espoir — les pistes, comptées à part et jamais mélangées. */
  caPistes: number;
  total: number;
}

export function crmTotals(rows: { statut: string; tarif_ht?: number | string | null }[]): CrmTotals {
  const t: CrmTotals = { actifs: 0, bloques: 0, caEngage: 0, caPistes: 0, total: rows.length };
  for (const r of rows) {
    const montant = parseTarif(r.tarif_ht) ?? 0;
    if (!isClosed(r.statut)) t.actifs++;
    if (r.statut === "en_attente") t.bloques++;
    if (countsAsRevenue(r.statut)) t.caEngage += montant;
    else if (r.statut === "piste") t.caPistes += montant;
  }
  return t;
}
