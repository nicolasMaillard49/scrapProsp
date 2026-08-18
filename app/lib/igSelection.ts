// Sélection du jour — la liste FERMÉE des comptes à démarcher aujourd'hui.
//
// Principe (décision Nicolas, 31/07/2026) : plus de liste infinie à trier à la
// main. Chaque jour, N prospects QUALIFIÉS PAR L'IA sont figés en base ; ceux
// qui n'ont pas été traités repartent tels quels le lendemain, et un prospect
// déjà servi ne revient jamais. Quand le stock qualifié est épuisé, le refill
// relance un scan hashtag + une qualification IA (voir `refillStock`).
//
// La partie PURE (dimensionnement, round-robin, report) est testable sans base.

import { supabase } from "./supabase";
import { warmupCaps, type AccountStatus, type Caps } from "./igPipeline";
import { getDueFollowups } from "./igCockpit";
import { detectMetier, isHorsCible, isActiveSince } from "./instagram";
import { generateMetierHashtags } from "./hashtags";
import { igSourceConfigured, chainDiagnostic, type SourceDiagnostic } from "./igSource";
import { qualifyAvailable } from "./igQualify";
import { collectLeads, resolveLeads, leadsStatus, nextHashtagFor } from "./igLeads";
import { qualifyRun, QUALIFY_RUN_CAP } from "./igQualifyRun";
import { setStage } from "./igStage";

/** Plafond d'abonnés — même filtre dur que le cockpit (comptes > 15k : mauvais taux de réponse). */
export const MAX_FOLLOWERS = 15000;

/** Jour Paris au format "YYYY-MM-DD" (clé de la sélection). */
export function parisDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

/* ────────────────────────────────────────────────────────────
 * Partie PURE
 * ──────────────────────────────────────────────────────────── */

/**
 * Nombre de créneaux d'accroche du jour : le plafond de chauffe du compte moins
 * les relances dues, qui puisent dans le MÊME quota (règle `nextFollowup`).
 * Le plafond dur reste appliqué par /api/instagram/dm à chaque envoi.
 */
export function daySlots(caps: Caps, dueFollowups: number): number {
  return Math.max(0, caps.daily - dueFollowups);
}

/**
 * Relances qui vont VRAIMENT partir aujourd'hui — les seules à décompter du quota.
 * Un M1 resté sans réponse ne se relance jamais (règle Nicolas) : la file
 * « à relancer » du cockpit est pleine de prospects restés au stade `accroche`
 * qui ne recevront rien. Les compter reviendrait à vider la sélection du jour.
 */
export function countRealFollowups(due: { stage: string | null }[]): number {
  return due.filter((d) => d.stage && d.stage !== "accroche").length;
}

export interface Selectable {
  id: string;
  username: string;
  bio?: string | null;
  full_name?: string | null;
  category?: string | null;
  metier?: string | null;
  profession_ia?: string | null;
  followers?: number | null;
  qualification?: string | null;
  last_post_at?: string | null;
  has_website?: boolean | null;
}

/**
 * « Sans site » — la cible prioritaire, puisque ce qu'on vend EST un site.
 *
 * `null` compte comme sans site : c'est la convention de tout le reste de
 * l'outil (filtre du pipeline, export CSV, `prospectScore` qui n'ajoute son
 * bonus que sur un `false` explicite mais ne pénalise pas l'inconnu). Un profil
 * dont on ignore s'il a un site vaut la peine d'être ouvert ; un profil dont on
 * SAIT qu'il en a un, beaucoup moins.
 */
export function estSansSite(l: Selectable): boolean {
  return l.has_website !== true;
}

/** Métier effectif — même résolution que le cockpit et la file d'envoi. */
export function metierOf(l: Selectable): string {
  return (
    detectMetier(l.profession_ia, null) ||
    detectMetier(l.category, `${l.username} ${l.bio ?? ""}`) ||
    l.metier ||
    ""
  );
}

/**
 * Qualité : uniquement le verdict IA « qualified », dans la cible francophone,
 * sous le plafond d'abonnés et actif depuis moins de 3 mois quand on connaît la
 * date du dernier post (inconnue = on laisse passer, le score l'a déjà pénalisé).
 */
export function isSelectable(l: Selectable, now = Date.now()): boolean {
  if (l.qualification !== "qualified") return false;
  if (!estSansSite(l)) return false;
  if (typeof l.followers === "number" && l.followers > MAX_FOLLOWERS) return false;
  if (isHorsCible(l)) return false;
  if (l.last_post_at && !isActiveSince(l.last_post_at, 3, now)) return false;
  return true;
}

/**
 * Plafond de prospects d'un MÊME métier dans une journée.
 *
 * Le round-robin seul ne suffit pas : il étale ce qu'on lui donne, il ne crée
 * pas de diversité. Quand le stock qualifié ne contient que deux métiers — le
 * cas normal, puisque le tri IA ne servait qu'une cible à la fois (cf.
 * `refillStep`) — il rend 25 podologues et 25 sages-femmes, et la journée est
 * ce qu'elle a été le 01/08 (97 % menuisier) puis le 04/08 (100 % libérales
 * médicales). Le plafond, lui, refuse de remplir la journée avec du déjà-vu.
 *
 * Il est VOLONTAIREMENT dur : les créneaux qu'il laisse vides maintiennent le
 * `shortfall` au-dessus de zéro, ce qui relance la boucle de refill sur
 * d'AUTRES métiers. C'est le manque qui répare le mix — le combler avec une
 * seconde passe non plafonnée redonnerait exactement l'ancien résultat.
 */
export const MAX_PER_METIER = 5;

export interface RoundRobinOptions {
  /** Plafond par métier (défaut `MAX_PER_METIER`). */
  maxPerMetier?: number;
  /**
   * Prospects DÉJÀ posés dans la journée, par métier. `ensureDailySelection`
   * complète la sélection à chaque appel : sans ce report, dix appels de suite
   * reposeraient chacun cinq podologues et le plafond ne vaudrait rien.
   */
  already?: Map<string, number>;
}

/**
 * Round-robin par métier : un prospect de chaque métier à tour de rôle, chaque
 * file gardant son ordre d'entrée (score décroissant). Sans ça, un tri par score
 * pur sort N prospects du même corps de métier et on ne compare plus rien.
 * Les prospects sans métier détecté ferment chaque tour (M1 générique = plus faible).
 * Aucun métier ne dépasse `maxPerMetier` sur la journée (voir la constante).
 */
export function roundRobinByMetier<T extends Selectable>(
  rows: T[],
  n: number,
  opts: RoundRobinOptions = {},
): T[] {
  const cap = Math.max(1, opts.maxPerMetier ?? MAX_PER_METIER);
  const pris = new Map(opts.already ?? []);

  const files = new Map<string, T[]>();
  for (const l of rows) {
    const m = metierOf(l).toLowerCase() || "(inconnu)";
    if (!files.has(m)) files.set(m, []);
    files.get(m)!.push(l);
  }
  const ordered = [...files.entries()].sort(
    (a, b) => Number(a[0] === "(inconnu)") - Number(b[0] === "(inconnu)"),
  );

  const out: T[] = [];
  for (let i = 0; out.length < n && ordered.some(([, f]) => f.length > i); i++) {
    let posesDansCeTour = 0;
    for (const [metier, f] of ordered) {
      if (out.length >= n) break;
      if (!f[i]) continue;
      if ((pris.get(metier) ?? 0) >= cap) continue;
      out.push(f[i]);
      pris.set(metier, (pris.get(metier) ?? 0) + 1);
      posesDansCeTour++;
    }
    // Tous les métiers encore servables sont au plafond : les tours suivants
    // ne poseraient rien non plus. On rend la main plutôt que de parcourir la
    // file la plus longue jusqu'au bout pour rien.
    if (!posesDansCeTour) break;
  }
  return out;
}

/** Ce qu'il reste à poser dans chacune des deux parts de la journée. */
export interface PartsDuJour {
  /** Créneaux à remplir UNIQUEMENT avec des profils sans site. */
  sansSite: number;
  /** Créneaux à remplir avec n'importe quel qualifié. */
  libre: number;
}

/**
 * Partage les créneaux restants entre la part réservée aux sans-site et la part
 * libre.
 *
 * `noSiteMin` est un PLANCHER, pas une cible : « au moins N lignes sans site
 * dans la journée ». Il s'écrête aux créneaux réels — en chauffe J2 il n'y en a
 * que dix, un plancher de 50 en vaut donc dix.
 *
 * Le décompte porte sur la JOURNÉE ENTIÈRE, reports d'hier compris, comme le
 * plafond par métier : sans ça, dix appels de suite réserveraient chacun 49
 * créneaux et la part libre ne serait jamais servie.
 *
 * Une ligne « avec site » reportée d'hier occupe physiquement un créneau qu'on
 * ne peut pas lui reprendre : elle mange donc la part réservée quand la part
 * libre est déjà pleine. Le plancher devient alors inatteignable pour
 * aujourd'hui — c'est un fait, pas une erreur, et le `shortfall` ne le masque
 * pas puisque la journée est bien pleine.
 */
export function partSansSite(
  slots: number,
  noSiteMin: number,
  dejaSansSite: number,
  dejaAvecSite: number,
): PartsDuJour {
  const reserve = Math.max(0, Math.min(Math.floor(noSiteMin), slots));
  const restants = Math.max(0, slots - dejaSansSite - dejaAvecSite);
  const sansSite = Math.max(0, Math.min(reserve - dejaSansSite, restants));
  return { sansSite, libre: restants - sansSite };
}

/* ────────────────────────────────────────────────────────────
 * Partie BASE
 * ──────────────────────────────────────────────────────────── */

/** Colonnes du prospect nécessaires à l'affichage de la sélection (M1 compris). */
const PROSPECT_COLS =
  "id, username, full_name, bio, category, metier, profession_ia, ville, booking_platform, has_website, " +
  "followers, score, score_tier, status, stage, qualification, qualification_reason, last_post_at, notes, reply_count";

export interface SelectionRow {
  prospect_id: string;
  rank: number;
  first_day: string;
  carry_count: number;
  done_at: string | null;
  skipped_at: string | null;
  skip_reason: string | null;
  prospect: Record<string, unknown>;
}

export interface DailySelection {
  day: string;
  accountId: string;
  /** Créneaux d'accroche du jour (plafond de chauffe − relances dues). */
  slots: number;
  rows: SelectionRow[];
  /** Lignes reprises d'un jour précédent, non traitées. */
  carried: number;
  /** Créneaux qu'on n'a PAS pu remplir faute de stock qualifié. */
  shortfall: number;
  /** Prospects qualifiés encore disponibles après cette sélection. */
  stockLeft: number;
  /** Part de cette réserve qui est SANS SITE — ce qui alimente le plancher. */
  stockLeftNoSite: number;
  /**
   * Plancher demandé pour ce compte, TEL QU'IL EST STOCKÉ — pas écrêté aux
   * créneaux. C'est lui que l'écran réaffiche : renvoyer la valeur écrêtée
   * ferait redescendre le réglage à chaque réaffichage sur un compte en chauffe
   * (50 demandés, 10 créneaux → 10 réécrits, et le 50 serait perdu pour demain).
   */
  noSiteMin: number;
  /** Lignes sans site réellement dans la journée (écartées exclues). */
  noSite: number;
  /**
   * Plafond par métier appliqué à cette journée. Remonté au cockpit parce qu'il
   * explique un `shortfall` que le stock seul contredirait (réserve pleine, mais
   * de métiers déjà servis) — et parce que le module n'est pas importable côté
   * client : il embarque les 450 Ko de `communes-fr.json`.
   */
  maxPerMetier: number;
}

interface AccountLite {
  id: string;
  username: string;
  status: AccountStatus;
  started_at: string;
  /** Plancher « sans site » du jour (migration 028). */
  no_site_min: number;
}

const ACCOUNT_COLS = "id, username, status, started_at, no_site_min";

async function loadAccount(accountId?: string): Promise<AccountLite> {
  const lire = (cols: string) => {
    const q = supabase.from("ig_accounts").select(cols);
    return accountId ? q.eq("id", accountId).limit(1) : q.order("created_at", { ascending: true }).limit(1);
  };

  let { data, error } = await lire(ACCOUNT_COLS);
  // Migration 028 pas encore passée : le cockpit ne doit pas tomber pour un
  // réglage. On relit sans la colonne et on retombe sur le comportement d'avant
  // (plancher 0 = aucune part réservée), plutôt que sur le défaut 50 — qui
  // viderait la journée alors que personne n'a rien demandé.
  if (error && /no_site_min/.test(error.message)) ({ data, error } = await lire("id, username, status, started_at"));
  if (error) throw new Error(error.message);

  const a = data?.[0] as unknown as Partial<AccountLite> | undefined;
  if (!a?.id) throw new Error("Aucun compte émetteur configuré (ig_accounts).");
  return { ...a, no_site_min: a.no_site_min ?? 0 } as AccountLite;
}

/** Écrit le plancher « sans site » d'un compte. Rend la valeur retenue. */
export async function setNoSiteMin(accountId: string | undefined, valeur: number): Promise<number> {
  const account = await loadAccount(accountId);
  // Mêmes bornes que la contrainte SQL : une saisie folle est ramenée dans le
  // domaine plutôt que rejetée — l'écrêtage au nombre de créneaux se fera de
  // toute façon à la génération.
  const n = Math.max(0, Math.min(100, Math.round(Number.isFinite(valeur) ? valeur : 0)));
  const { error } = await supabase.from("ig_accounts").update({ no_site_min: n }).eq("id", account.id);
  if (error) throw new Error(error.message);
  return n;
}

/**
 * Sélection du jour pour un compte, créée si elle n'existe pas encore :
 *  1. report des lignes ouvertes des jours précédents (carry_count +1) ;
 *  2. complétion jusqu'au nombre de créneaux avec le meilleur stock qualifié ;
 *  3. aucun prospect déjà passé en sélection n'est repris.
 * Idempotent : rappelée le même jour, elle complète seulement ce qui manque.
 */
export async function ensureDailySelection(accountId?: string, now = new Date()): Promise<DailySelection> {
  const account = await loadAccount(accountId);
  const day = parisDayKey(now);
  const caps = warmupCaps(account.started_at, account.status, now.getTime());
  const due = await getDueFollowups(now, 200);
  const slots = daySlots(caps, countRealFollowups(due));

  // 1) Report : les lignes encore ouvertes d'un jour précédent basculent sur aujourd'hui.
  const { data: openRows, error: openErr } = await supabase
    .from("ig_daily_selection")
    .select("id, day, prospect_id, rank, first_day, carry_count")
    .eq("account_id", account.id)
    .is("done_at", null)
    .is("skipped_at", null)
    .lt("day", day)
    .order("rank", { ascending: true });
  if (openErr) throw new Error(openErr.message);

  for (const r of openRows ?? []) {
    const { error } = await supabase
      .from("ig_daily_selection")
      .update({ day, carry_count: (r.carry_count as number) + 1 })
      .eq("id", r.id as string);
    // Conflit d'unicité = la ligne du jour existe déjà pour ce prospect : on purge le doublon.
    if (error) await supabase.from("ig_daily_selection").delete().eq("id", r.id as string);
  }

  // Un site avéré peut avoir été découvert après la composition de la journée,
  // ou vivre dans un report ancien. Il sort alors immédiatement de la file :
  // le prospect reste en base, mais cette cible ne doit plus être démarchée.
  const avecSiteOuverts = (await readSelectionRows(account.id, day))
    .filter((r) => !r.done_at && !r.skipped_at && !estSansSite(r.prospect as unknown as Selectable))
    .map((r) => r.prospect_id);
  if (avecSiteOuverts.length) {
    const { error } = await supabase
      .from("ig_daily_selection")
      .update({ skipped_at: now.toISOString(), skip_reason: "site internet avéré — purge automatique" })
      .eq("account_id", account.id)
      .eq("day", day)
      .in("prospect_id", avecSiteOuverts)
      .is("done_at", null)
      .is("skipped_at", null);
    if (error) throw new Error(error.message);
  }

  // 2) État de la sélection du jour après report.
  const { data: todayRows, error: todayErr } = await supabase
    .from("ig_daily_selection")
    .select("prospect_id, rank, first_day, carry_count, done_at, skipped_at")
    .eq("account_id", account.id)
    .eq("day", day)
    .order("rank", { ascending: true });
  if (todayErr) throw new Error(todayErr.message);
  const existing = todayRows ?? [];
  const carried = existing.filter((r) => (r.carry_count as number) > 0).length;

  // 3) Complétion — on ne compte que les lignes non écartées dans les créneaux.
  const active = existing.filter((r) => !r.skipped_at).length;
  const missing = Math.max(0, slots - active);
  let stockLeft = 0;
  let stockLeftNoSite = 0;

  if (missing > 0) {
    // Le plafond par métier ET le plancher sans-site se comptent sur la JOURNÉE
    // entière, reports compris : on repart de ce qui est déjà posé, pas de zéro.
    const etat = await etatDuJour(account.id, day);
    const parts = partSansSite(slots, account.no_site_min, etat.sansSite, etat.avecSite);
    // La liste des déjà-servis est la requête la plus lourde du module : on la
    // lit UNE fois pour les deux parts.
    const served = await loadServed();
    const exclure = new Set<string>();

    // La part réservée d'abord — c'est elle, la contrainte ; la part libre n'est
    // que le reliquat. Dans l'autre sens, la part libre chiperait les sans-site
    // les mieux notés et creuserait un manque qu'on paierait ensuite en chasse.
    const reserve = await pickFreshProspects(parts.sansSite, now, etat.metiers, { served, sansSiteOnly: true });
    stockLeftNoSite = Math.max(0, reserve.stock - reserve.fresh.length);
    for (const p of reserve.fresh) {
      exclure.add(p.id);
      // `roundRobinByMetier` recopie le compteur qu'on lui passe : sans cette
      // mise à jour, la part libre repartirait d'un plafond métier vierge et la
      // journée pourrait contenir dix fois le même métier.
      const m = metierOf(p).toLowerCase() || "(inconnu)";
      etat.metiers.set(m, (etat.metiers.get(m) ?? 0) + 1);
    }

    // Appelée même quand la part libre est nulle : son `stock` est la jauge de
    // réserve affichée par le cockpit.
    const libre = await pickFreshProspects(parts.libre, now, etat.metiers, { served, exclure });
    stockLeft = Math.max(0, libre.stock - libre.fresh.length);

    const fresh = [...reserve.fresh, ...libre.fresh];
    let rank = existing.length ? Math.max(...existing.map((r) => r.rank as number)) + 1 : 0;
    const toInsert = fresh.map((p) => ({
      day,
      account_id: account.id,
      prospect_id: p.id,
      rank: rank++,
      first_day: day,
      carry_count: 0,
    }));
    if (toInsert.length) {
      const { error } = await supabase.from("ig_daily_selection").insert(toInsert);
      if (error) throw new Error(error.message);
    }
  }

  // `shortfall` se lit sur l'état final : une ligne écartée rouvre un créneau.
  const rows = await readSelectionRows(account.id, day);
  const actives = rows.filter((r) => !r.skipped_at);
  return {
    day,
    accountId: account.id,
    slots,
    rows,
    carried,
    shortfall: Math.max(0, slots - actives.length),
    stockLeft,
    stockLeftNoSite,
    noSiteMin: account.no_site_min,
    noSite: actives.filter((r) => estSansSite(r.prospect as unknown as Selectable)).length,
    maxPerMetier: MAX_PER_METIER,
  };
}

/** Lignes de la sélection d'un jour, prospect joint, dans l'ordre de traitement. */
export async function readSelectionRows(accountId: string, day: string): Promise<SelectionRow[]> {
  const { data, error } = await supabase
    .from("ig_daily_selection")
    .select(`prospect_id, rank, first_day, carry_count, done_at, skipped_at, skip_reason, prospect:instagram_prospects(${PROSPECT_COLS})`)
    .eq("account_id", accountId)
    .eq("day", day)
    .order("rank", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as SelectionRow[]).filter((r) => r.prospect);
}

/** Ce que la journée contient DÉJÀ, vu des deux contraintes de composition. */
interface EtatDuJour {
  /** Métiers déjà posés → plafond `MAX_PER_METIER`. */
  metiers: Map<string, number>;
  /** Lignes sans site déjà posées → plancher `no_site_min`. */
  sansSite: number;
  /** Lignes avec site déjà posées : elles occupent des créneaux pour de bon. */
  avecSite: number;
}

/**
 * État de composition de la journée (lignes écartées exclues : elles ont rendu
 * leur créneau, elles ne doivent consommer ni le plafond métier ni le plancher).
 */
async function etatDuJour(accountId: string, day: string): Promise<EtatDuJour> {
  const rows = await readSelectionRows(accountId, day);
  const etat: EtatDuJour = { metiers: new Map(), sansSite: 0, avecSite: 0 };
  for (const r of rows) {
    if (r.skipped_at) continue;
    const p = r.prospect as unknown as Selectable;
    const m = metierOf(p).toLowerCase() || "(inconnu)";
    etat.metiers.set(m, (etat.metiers.get(m) ?? 0) + 1);
    if (estSansSite(p)) etat.sansSite++;
    else etat.avecSite++;
  }
  return etat;
}

/** Prospects déjà passés en sélection un jour quelconque — ils ne reviennent jamais. */
async function loadServed(): Promise<Set<string>> {
  const { data } = await supabase.from("ig_daily_selection").select("prospect_id").limit(50_000);
  return new Set((data ?? []).map((r) => r.prospect_id as string));
}

interface PickOptions {
  /** Déjà-servis, lus une seule fois par génération. */
  served?: Set<string>;
  /** Restreint au vivier sans site (part réservée du jour). */
  sansSiteOnly?: boolean;
  /** Prospects posés par la part précédente du MÊME appel de génération. */
  exclure?: Set<string>;
}

/**
 * Meilleurs prospects encore jamais sélectionnés, filtrés qualité puis mixés
 * par métier sous plafond. On sur-récupère (×6) car les filtres qualité qui ne
 * s'expriment pas en SQL (hors-cible, activité) se jouent côté JS.
 */
async function pickFreshProspects(
  n: number,
  now: Date,
  dejaPoses?: Map<string, number>,
  opts: PickOptions = {},
): Promise<{ fresh: Selectable[]; stock: number }> {
  const served = opts.served ?? (await loadServed());

  let q = supabase
    .from("instagram_prospects")
    .select(PROSPECT_COLS)
    .eq("status", "todo")
    .eq("qualification", "qualified")
    .is("stage", null)
    .not("has_website", "is", true)
    // `followers <= N` vaut NULL en SQL pour un compte sans nombre d'abonnés et
    // l'exclurait : on garde ces comptes, `isSelectable` les accepte aussi.
    .or(`followers.lte.${MAX_FOLLOWERS},followers.is.null`);

  // L'exclusion « avec site » se fait en SQL et pas après coup : un filtrage côté JS
  // sur la fenêtre déjà récupérée annoncerait « réserve sans site épuisée » dès
  // que les avec-site occupent le haut du classement — et déclencherait une
  // chasse payante pour rien. `not.is.true` couvre false ET null, la définition
  // retenue partout ailleurs (cf. `estSansSite`).
  const { data, error } = await q.order("score", { ascending: false, nullsFirst: false }).limit(Math.max(200, n * 6));
  if (error) throw new Error(error.message);

  const pool = ((data ?? []) as unknown as Selectable[]).filter(
    (p) => !served.has(p.id) && !opts.exclure?.has(p.id) && isSelectable(p, now.getTime()),
  );
  return { fresh: roundRobinByMetier(pool, n, { already: dejaPoses }), stock: pool.length };
}

/**
 * Compte les prospects qualifiés jamais sélectionnés (jauge de stock du cockpit).
 * `sansSiteOnly` restreint au vivier qui alimente le plancher : c'est lui, et
 * pas le total, qui explique une journée incomplète quand le plancher est haut.
 */
export async function countAvailableStock(now = new Date(), sansSiteOnly = false): Promise<number> {
  const { stock } = await pickFreshProspects(0, now, undefined, { sansSiteOnly });
  return stock;
}

/**
 * Marque la ligne de sélection d'un prospect comme traitée. Appelé par
 * /api/instagram/dm au premier M1 : la sélection se vide donc toute seule,
 * sans clic supplémentaire.
 */
export async function markSelectionDone(prospectId: string, now = new Date()): Promise<void> {
  await supabase
    .from("ig_daily_selection")
    .update({ done_at: now.toISOString() })
    .eq("prospect_id", prospectId)
    .is("done_at", null)
    .is("skipped_at", null);
}

/** Écarte un prospect de la sélection (il ne sera pas reporté demain). */
export async function skipSelection(prospectId: string, reason: string | null, now = new Date()): Promise<void> {
  const { error } = await supabase
    .from("ig_daily_selection")
    .update({ skipped_at: now.toISOString(), skip_reason: reason })
    .eq("prospect_id", prospectId)
    .is("done_at", null)
    .is("skipped_at", null);
  if (error) throw new Error(error.message);
}

/**
 * PERDU en un clic depuis la sélection du jour, AVANT toute accroche.
 *
 * Le cas de terrain : on ouvre le profil, on découvre que le compte n'accepte
 * pas les DM (messages fermés, compte pro sans bouton). La corbeille ne fait
 * que retirer la ligne du jour — le prospect reste `todo` dans la base et
 * ressort partout ailleurs. Il fallait donc aller le rouvrir dans le pipeline
 * pour le passer « perdu », alors que l'information est connue ici, tout de
 * suite. On fait les deux gestes d'un coup.
 *
 * Mêmes règles de cohérence que le bouton « Perdu » du pipeline (route PATCH) :
 * stade `perdu`, statut `negative`, relances coupées. Aucun DM n'ayant été
 * envoyé, il n'y a rien à purger du journal — contrairement à `cancelContact`.
 */
export async function markLostFromSelection(prospectId: string, reason: string | null): Promise<void> {
  // Tout est dans igStage, seul écrivain du stade : « perdu » y coupe les
  // relances ET écarte la ligne du jour.
  await setStage(prospectId, "perdu", reason);
}

/**
 * ANNULE une accroche déjà marquée « envoyée » et sort le prospect de la
 * journée, sans laisser de trace dans les compteurs.
 *
 * Le besoin vient du terrain : « Prendre contact » ouvre Instagram et marque le
 * DM comme parti, mais on découvre parfois APRÈS coup que le compte est
 * inatteignable (DM fermés, compte suspendu) ou déjà démarché hors outil — le
 * cas `crea_ton_paysage_`, contacté à la main le 21/07 sans que la base le
 * sache, donc reproposé le 31/07. Sans annulation, ces faux positifs gonflent
 * les KPI d'accroches et faussent le taux de réponse.
 *
 * On efface donc le DM du journal et on remet le prospect dans l'état d'avant,
 * plutôt que de simplement le masquer.
 */
export async function cancelContact(prospectId: string, reason: string | null, now = new Date()): Promise<void> {
  // 1) Le journal des DM sortants alimente les KPI : c'est lui qu'il faut purger.
  const { error: logErr } = await supabase.from("ig_dm_log").delete().eq("prospect_id", prospectId);
  if (logErr) throw new Error(`journal DM : ${logErr.message}`);

  // 2) Le prospect redevient non démarché. `status: "todo"` le rendrait à
  //    nouveau sélectionnable : on le passe en `skipped` pour qu'il sorte du
  //    circuit sans revenir demain.
  const { error: proErr } = await supabase
    .from("instagram_prospects")
    .update({ status: "skipped", stage: null, last_dm_at: null, followup_count: 0, next_followup_at: null })
    .eq("id", prospectId);
  if (proErr) throw new Error(`prospect : ${proErr.message}`);

  // 3) La ligne du jour passe d'« envoyée » à « écartée » — elle reste visible,
  //    grisée, mais ne compte plus comme une accroche.
  const { error: selErr } = await supabase
    .from("ig_daily_selection")
    .update({ done_at: null, skipped_at: now.toISOString(), skip_reason: reason ?? "contact annulé" })
    .eq("prospect_id", prospectId);
  if (selErr) throw new Error(`sélection : ${selErr.message}`);
}

/* ────────────────────────────────────────────────────────────
 * Refill : quand le stock qualifié ne suffit plus, on repart en chasse.
 * ──────────────────────────────────────────────────────────── */

export interface HuntTarget {
  id: string;
  metier: string;
  avatar_profession: string;
  min_followers: number;
  max_followers: number;
  last_scan_at: string | null;
  poids: number;
  scans: number;
}

/** Bilan d'un refill complet : ce qui a été fait, marche par marche. */
export interface RefillRun {
  ran: boolean;
  reason?: string;
  /** Détail de chaque marche franchie, dans l'ordre. */
  steps: RefillResult[];
  /** Cumuls, pour l'affichage. */
  inserted: number;
  qualified: number;
  /** Bilan IA cumulé — pour expliquer « 0 retenus » (l'IA a-t-elle tout jeté ?). */
  processed?: number;
  borderline?: number;
  rejected?: number;
  /** Exemples de verdicts IA (raison) de la dernière marche qui a trié. */
  samples?: { username: string; verdict: string; reason: string | null }[];
  /** Erreur Anthropic rencontrée pendant le tri — la cause d'un « 0 traité ». */
  iaError?: string;
  /** Créneaux qu'il restait à pourvoir au départ, et à l'arrivée. */
  shortfallBefore: number;
  shortfallAfter: number;
  /** Pourquoi on s'est arrêté. */
  stopped: "sélection pleine" | "plus rien à faire" | "temps écoulé" | "trop de tours" | "IA en panne";
  /**
   * État des sources quand le refill n'a PAS pu compléter la sélection —
   * pour afficher à l'écran POURQUOI (crédits Apify épuisés, abo RapidAPI
   * manquant, source écartée…) plutôt qu'un « Chasse en cours » muet.
   */
  diagnostic?: SourceDiagnostic;
}

export interface RefillResult {
  ran: boolean;
  /**
   * L'escalier, du moins cher au plus cher :
   *  « qualify » — tri IA du stock déjà scrapé (aucun appel de scraping) ;
   *  « resolve » — un lot de pistes transformé en prospects (1 requête/profil) ;
   *  « collect » — file vide, on réalimente depuis un hashtag (1 requête).
   */
  mode?: "qualify" | "resolve" | "collect";
  /** Source ayant servi — absent tant que c'est Apify (le cas nominal). */
  source?: string;
  /** Pistes encore en attente de résolution. */
  pending?: number;
  /** Pistes nouvellement mises en file (mode collect). */
  queued?: number;
  reason?: string;
  metier?: string;
  hashtag?: string;
  scanned?: number;
  inserted?: number;
  /** Nombre de comptes passés « qualified » par l'IA sur ce run. */
  qualified?: number;
  /** Verdicts « borderline » / « rejected » — pour voir si l'IA jette tout. */
  borderline?: number;
  rejected?: number;
  /** Profils soumis à l'IA. */
  processed?: number;
  /** Exemples de verdicts (raison IA) — pour comprendre POURQUOI 0 retenu. */
  samples?: { username: string; verdict: string; reason: string | null }[];
  /** Erreur Anthropic (crédits/clé/modèle) — l'IA n'a rien traité, pas « tout rejeté ». */
  iaError?: string;
  /** Détail des sources quand cette marche a échoué sur une panne de source. */
  diagnostic?: SourceDiagnostic;
}

/**
 * Prochain hashtag JAMAIS scanné pour ce métier. La bibliothèque de hashtags
 * métier est déterministe, et `hashtag_source` mémorise ceux déjà passés : pas
 * besoin d'état supplémentaire pour savoir où on en est.
 */


/** Toute la bibliothèque de hashtags d'un métier (sert de clé de rattachement). */
function hashtagsOf(metier: string): string[] {
  return generateMetierHashtags(metier, { includeTransversal: false }).map((r) => r.hashtag);
}

/**
 * Prospects `todo` encore sans verdict IA rattachables à un métier — par la
 * colonne `metier` OU par le hashtag d'origine. Le rattachement par hashtag est
 * indispensable : `detectMetier` laisse `metier` vide dès que ni la catégorie ni
 * la bio ne matchent (128 prospects dans ce cas au 31/07), et ce stock devenait
 * alors invisible pour le refill.
 */
async function unqualifiedCount(metier: string): Promise<number> {
  const tags = hashtagsOf(metier);
  const { count } = await supabase
    .from("instagram_prospects")
    .select("id", { count: "exact", head: true })
    .eq("status", "todo")
    .is("qualification", null)
    .or(`metier.eq.${metier},hashtag_source.in.(${tags.join(",")})`);
  return count ?? 0;
}

/**
 * Reconstitue du stock qualifié, du moins cher au plus cher :
 *  1. TRI IA du stock déjà scrapé mais jamais passé devant l'IA (coût Claude seul) ;
 *  2. seulement s'il n'en reste plus, SCAN Apify du prochain hashtag inutilisé,
 *     suivi de la qualification des profils insérés.
 * Un seul métier / un seul hashtag par appel : le coût reste borné et prévisible.
 * Appelé par le cron du matin quand la sélection n'a pas pu être remplie, ou à
 * la main depuis le cockpit.
 */
/**
 * Recharge la sélection EN UN SEUL APPEL : enchaîne les marches jusqu'à ce que
 * les créneaux soient pourvus.
 *
 * Chaque marche prise isolément ne fait qu'un pas (trier un lot, résoudre un
 * lot, repérer un hashtag) ; il en faut plusieurs pour transformer des pistes
 * brutes en prospects sélectionnables. Laisser l'utilisateur recliquer entre
 * chaque était la vraie friction : le cockpit annonçait « plus assez de comptes
 * qualifiés » sans dire que 97 pistes attendaient juste d'être traitées.
 *
 * Bornes : le budget temps reste largement sous le maxDuration de 300 s des
 * routes, et le nombre de tours évite qu'une étape stérile ne boucle.
 */
const REFILL_BUDGET_MS = Math.max(30_000, Number(process.env.IG_REFILL_BUDGET_MS) || 200_000);
const REFILL_MAX_STEPS = Math.max(1, Number(process.env.IG_REFILL_MAX_STEPS) || 8);
/**
 * Durée à réserver à la marche qu'on s'apprête à lancer. Le budget était vérifié
 * AVANT chaque marche mais jamais pendant : une résolution démarrée à 199 s
 * (jusqu'à 120 s de résolution + un lot Claude) finissait au-delà du maxDuration
 * de 300 s de Vercel. Le 01/08 la fonction a été tuée juste après l'insertion de
 * 37 profils : ils sont restés sans verdict, donc invisibles pour la sélection,
 * alors qu'un seul appel Claude les séparait du stock.
 * On n'engage donc une marche que s'il reste de quoi la finir.
 */
const REFILL_STEP_RESERVE_MS = Math.max(30_000, Number(process.env.IG_REFILL_STEP_RESERVE_MS) || 150_000);

/**
 * Options de budget. Le cron (pas de client) garde les longues bornes par
 * défaut ; l'appel interactif « Aller en chercher » en passe de courtes, pour
 * que CHAQUE requête revienne en quelques dizaines de secondes. Sur mobile une
 * requête tenue 2-3 min meurt (écran verrouillé, bascule d'app, handoff 5G) et
 * le navigateur affiche « Load failed » — le client relance alors une passe
 * courte suivante, rien n'est perdu (le refill requalifie d'abord les orphelins).
 */
export interface RefillOptions {
  budgetMs?: number;
  maxSteps?: number;
  stepReserveMs?: number;
  /** Borne la résolution d'une marche (nb de profils + temps) — court en interactif. */
  resolveLimit?: number;
  resolveBudgetMs?: number;
}

export async function refillStock(now = new Date(), opts?: RefillOptions): Promise<RefillRun> {
  const budgetMs = Math.max(15_000, opts?.budgetMs ?? REFILL_BUDGET_MS);
  const maxSteps = Math.max(1, opts?.maxSteps ?? REFILL_MAX_STEPS);
  const stepReserveMs = Math.max(5_000, opts?.stepReserveMs ?? REFILL_STEP_RESERVE_MS);
  const stepOpts = { resolveLimit: opts?.resolveLimit, resolveBudgetMs: opts?.resolveBudgetMs };
  const started = Date.now();
  const before = await ensureDailySelection(undefined, now);
  const steps: RefillResult[] = [];
  let stopped: RefillRun["stopped"] = "trop de tours";
  let shortfall = before.shortfall;

  if (!shortfall) {
    return { ran: false, reason: "Sélection déjà complète.", steps, inserted: 0, qualified: 0, shortfallBefore: 0, shortfallAfter: 0, stopped: "sélection pleine" };
  }

  // Cibles dont le tri IA n'a rien donné pendant CE run : inutile de les
  // représenter à Claude à chaque marche (cf. `refillStep`).
  const sterile = new Set<string>();

  for (let i = 0; i < maxSteps; i++) {
    if (Date.now() - started > budgetMs - stepReserveMs) {
      stopped = "temps écoulé";
      break;
    }
    const step = await refillStep(now, sterile, stepOpts);
    if (!step.ran) {
      // Plus aucune marche disponible : on garde la raison pour l'afficher.
      steps.push(step);
      stopped = "plus rien à faire";
      break;
    }
    steps.push(step);

    // IA en panne (crédits Anthropic, clé, modèle) : chaque marche suivante
    // dépenserait du quota looter pour des profils que personne ne triera.
    // On coupe le run — la boucle appelante (VPS/cron) s'arrête sur ce motif.
    if (step.iaError) {
      stopped = "IA en panne";
      break;
    }

    // Une collecte ne crée aucun prospect : inutile de recompter la sélection,
    // elle ne peut pas avoir bougé.
    if (step.mode === "collect") continue;

    shortfall = (await ensureDailySelection(undefined, now)).shortfall;
    if (!shortfall) {
      stopped = "sélection pleine";
      break;
    }
  }

  const ran = steps.some((s) => s.ran);
  // Diagnostic des sources : on ne le remonte QUE si la chaîne est réellement
  // bloquée — c'est-à-dire AUCUNE source utilisable. Apify à sec pendant que
  // looter/stable prennent le relais n'est PAS un blocage (c'est le principe du
  // fallback) : afficher un bloc rouge « source indisponible » dans ce cas était
  // un faux positif. Quand une source marche encore, le vrai frein est ailleurs
  // (qualif IA, hashtags épuisés, temps écoulé) et les messages le disent.
  let diagnostic: SourceDiagnostic | undefined;
  if (shortfall > 0) {
    const d = [...steps].reverse().find((s) => s.diagnostic)?.diagnostic ?? (await chainDiagnostic().catch(() => undefined));
    if (d && !d.providers.some((p) => p.available)) diagnostic = d;
  }
  return {
    ran,
    reason: ran ? undefined : steps.find((s) => !s.ran)?.reason,
    steps,
    inserted: steps.reduce((n, s) => n + (s.inserted ?? 0), 0),
    qualified: steps.reduce((n, s) => n + (s.qualified ?? 0), 0),
    processed: steps.reduce((n, s) => n + (s.processed ?? 0), 0),
    borderline: steps.reduce((n, s) => n + (s.borderline ?? 0), 0),
    rejected: steps.reduce((n, s) => n + (s.rejected ?? 0), 0),
    // Exemples de la dernière marche qui a réellement trié des profils.
    samples: [...steps].reverse().find((s) => s.samples?.length)?.samples,
    iaError: [...steps].reverse().find((s) => s.iaError)?.iaError,
    shortfallBefore: before.shortfall,
    shortfallAfter: shortfall,
    stopped,
    diagnostic,
  };
}

/**
 * Marque une cible comme SERVIE — c'est ce qui fait tourner le tourniquet.
 *
 * `scans` ne comptait que les collectes. Or une marche `qualify` ou `resolve`
 * consomme elle aussi un tour (et du Claude), sans jamais faire avancer le
 * compteur : la cible en tête de dette restait en tête et le refill la
 * redrainait lot après lot — 400 profils par marche, tous du même métier. C'est
 * l'unique cause des journées mono-métier (01/08 : 97 % menuisier ; 04/08 :
 * 100 % de libérales médicales) alors que 4 358 prospects bien mixés dormaient
 * sans verdict. Un tour servi, quel qu'il soit, avance donc le compteur.
 *
 * Lu-puis-écrit sans verrou : le refill a un seul appelant (le cron), et deux
 * tours simultanés ne coûteraient qu'un passage en trop.
 */
async function markTargetServed(t: HuntTarget, now: Date): Promise<void> {
  await supabase
    .from("ig_hunt_targets")
    .update({ last_scan_at: now.toISOString(), scans: (t.scans ?? 0) + 1 })
    .eq("id", t.id);
}

/** Date du dernier scan en ms — jamais scanné = 0, donc prioritaire. */
function scanTime(iso: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Une marche du refill. `sterile` mémorise, le temps d'un `refillStock`, les
 * cibles dont le tri IA n'a rien fait bouger : sans ça le refill boucle dessus.
 */
async function refillStep(
  now = new Date(),
  sterile = new Set<string>(),
  opts?: { resolveLimit?: number; resolveBudgetMs?: number },
): Promise<RefillResult> {
  if (!qualifyAvailable()) return { ran: false, reason: "ANTHROPIC_API_KEY manquant — qualification impossible." };

  const { data, error } = await supabase
    .from("ig_hunt_targets")
    .select("id, metier, avatar_profession, min_followers, max_followers, last_scan_at, poids, scans")
    .eq("active", true);
  if (error) throw new Error(error.message);

  // Tourniquet PONDÉRÉ. On sert la cible la moins servie AU REGARD DE SON POIDS :
  // à poids 3 contre 1, l'artisan encaisse trois collectes quand la libérale en
  // encaisse une. Le rapport ne dépend pas de la fréquence des refills — un tri
  // par ancienneté, lui, s'aplatit dès que les tours s'espacent (cf. migration 023).
  // Le tri est fait ici et pas en SQL : Postgres ne l'ordonne pas sans vue dédiée
  // et la table tient en quelques dizaines de lignes.
  //
  // Départages, dans l'ordre : le POIDS d'abord, l'ancienneté du scan ensuite.
  // Sans le poids, une table fraîchement migrée (tous les `scans` à 0, tous les
  // `last_scan_at` nuls) laisse l'ordre d'insertion décider — le 01/08 les 16
  // libérales, insérées en premier, passaient devant les 10 artisans à poids 3.
  //
  // Et surtout : PAS de `slice`. Un plafond sur la liste triée gelait les cibles
  // au-delà du rang N, qui ne pouvaient plus jamais incrémenter `scans` — donc
  // plus jamais remonter dans le tri. Les boucles ci-dessous s'arrêtent à la
  // première cible productive : le coût est borné par elles, pas par la taille
  // de la liste.
  const targets = (data ?? [])
    .map((t) => ({ cible: t as HuntTarget, dette: (t.scans ?? 0) / Math.max(1, t.poids ?? 1) }))
    .sort(
      (a, b) =>
        a.dette - b.dette ||
        (b.cible.poids ?? 1) - (a.cible.poids ?? 1) ||
        scanTime(a.cible.last_scan_at) - scanTime(b.cible.last_scan_at),
    )
    .map((x) => x.cible);
  if (!targets.length) return { ran: false, reason: "Aucune cible de chasse active (table ig_hunt_targets)." };

  // 1) Le moins cher d'abord : trier ce qui dort déjà en base sans verdict IA.
  //    `status: "todo"` est OBLIGATOIRE — sans lui le tri part sur les plus
  //    récents tous statuts confondus et ne produit que des verdicts sur des
  //    comptes déjà démarchés, qui n'entreront jamais dans la sélection.
  for (const t of targets) {
    if (sterile.has(t.metier)) continue;
    const avant = await unqualifiedCount(t.metier);
    if (avant === 0) continue;
    const qual = await qualifyRun({
      scope: { metier: t.metier, hashtags: hashtagsOf(t.metier) },
      status: "todo",
      onlyUnqualified: true,
      limit: QUALIFY_RUN_CAP,
      avatar: { profession: t.avatar_profession, minFollowers: t.min_followers, maxFollowers: t.max_followers },
    });

    // Un profil que le modèle omet de son verdict (`parseQualifyResponse` ne
    // garde que les pseudos reconnus) reste `qualification = null` — donc
    // éternellement « à trier ». Le 01/08, un menuisier orphelin a fait tourner
    // le refill 96 fois d'affilée sur la même ligne sans jamais atteindre la
    // collecte. On mesure donc le progrès RÉEL, et une cible qui n'en fait pas
    // est écartée pour le reste du run.
    // Le tour a été servi (et payé en Claude) qu'il ait produit ou non : dans
    // les deux cas la cible passe la main. Sans ça, une cible stérile revient
    // en tête à CHAQUE nouveau refill et y brûle un lot — `sterile` ne la
    // protège que le temps d'un run.
    await markTargetServed(t, now);

    if ((await unqualifiedCount(t.metier)) >= avant) {
      sterile.add(t.metier);
      continue;
    }

    return {
      ran: true,
      mode: "qualify",
      metier: t.metier,
      processed: qual.processed,
      qualified: qual.qualified,
      borderline: qual.borderline,
      rejected: qual.rejected,
      samples: qual.samples,
      // Un lot parti à l'IA mais AUCUN verdict rendu = panne (API ou réponse
      // illisible) : la note de qualifyRun fait foi quand l'API n'a rien dit.
      iaError: qual.iaError ?? (qual.processed === 0 && qual.selected > 0 ? qual.note : undefined),
    };
  }

  // 2) Plus rien à trier : on dépile la file de pistes déjà collectées.
  //    Un LOT, pas tout : les relais RapidAPI résolvent un profil par requête à
  //    ~5 s pièce, et un scan monolithique dépassait le maxDuration de la route
  //    sans jamais rendre la main (cockpit muet, cf. migration 021).
  if (!igSourceConfigured) return { ran: false, reason: "stock trié en totalité et aucune source configurée (RAPIDAPI_KEY) — scan impossible." };

  const pendingByMetier = new Map((await leadsStatus()).byMetier.map((b) => [b.metier, b.pending]));

  for (const t of targets) {
    if (!pendingByMetier.get(t.metier)) continue;
    const res = await resolveLeads(opts?.resolveLimit, t.metier, { budgetMs: opts?.resolveBudgetMs });
    await markTargetServed(t, now); // une résolution consomme un tour, comme une collecte
    if (!res.inserted) continue;

    // Même cadrage qu'en 1) : `scope` + `status`. Sans eux, le tri part sur les
    // plus récents TOUS statuts confondus et peut brûler son lot sur des comptes
    // déjà démarchés — les profils qu'on vient d'insérer, eux, ne recevraient
    // jamais de verdict et resteraient invisibles pour la sélection.
    const qual = await qualifyRun({
      scope: { metier: t.metier, hashtags: hashtagsOf(t.metier) },
      status: "todo",
      onlyUnqualified: true,
      limit: Math.min(Math.max(res.inserted, 1), QUALIFY_RUN_CAP),
      avatar: {
        profession: t.avatar_profession,
        minFollowers: t.min_followers,
        maxFollowers: t.max_followers,
      },
    });

    return {
      ran: true,
      mode: "resolve",
      metier: t.metier,
      inserted: res.inserted,
      pending: res.pending,
      processed: qual.processed,
      qualified: qual.qualified,
      borderline: qual.borderline,
      rejected: qual.rejected,
      samples: qual.samples,
      iaError: qual.iaError ?? (qual.processed === 0 && qual.selected > 0 ? qual.note : undefined),
    };
  }

  // 3) File vide : on la réalimente. Bon marché (1 requête ≈ 30 pistes) et
  //    instantané — la résolution attendra le prochain tour.
  for (const t of targets) {
    const hashtag = await nextHashtagFor(t.metier);
    if (!hashtag) continue;
    try {
      const got = await collectLeads(hashtag, t.metier);
      await markTargetServed(t, now);
      return {
        ran: true,
        mode: "collect",
        metier: t.metier,
        hashtag,
        source: got.provider !== "apify" ? got.provider : undefined,
        queued: got.queued,
        pending: (await leadsStatus()).pending,
      };
    } catch (e) {
      // Une source à terre ne doit pas faire tomber le cron du matin : on
      // remonte la raison ET le diagnostic (quelle source, pourquoi), le récap
      // Telegram et l'écran le diront.
      const msg = e instanceof Error ? e.message : String(e);
      const diagnostic = await chainDiagnostic(e).catch(() => undefined);
      return { ran: false, reason: `collecte #${hashtag} impossible — ${msg.slice(0, 160)}`, diagnostic };
    }
  }

  return { ran: false, reason: "Toutes les cibles ont épuisé leur bibliothèque de hashtags — ajoute des métiers dans ig_hunt_targets." };
}
