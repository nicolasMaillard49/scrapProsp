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
  if (typeof l.followers === "number" && l.followers > MAX_FOLLOWERS) return false;
  if (isHorsCible(l)) return false;
  if (l.last_post_at && !isActiveSince(l.last_post_at, 3, now)) return false;
  return true;
}

/**
 * Round-robin par métier : un prospect de chaque métier à tour de rôle, chaque
 * file gardant son ordre d'entrée (score décroissant). Sans ça, un tri par score
 * pur sort N prospects du même corps de métier et on ne compare plus rien.
 * Les prospects sans métier détecté ferment chaque tour (M1 générique = plus faible).
 */
export function roundRobinByMetier<T extends Selectable>(rows: T[], n: number): T[] {
  const files = new Map<string, T[]>();
  for (const l of rows) {
    const m = metierOf(l).toLowerCase() || "(inconnu)";
    if (!files.has(m)) files.set(m, []);
    files.get(m)!.push(l);
  }
  const ordered = [...files.entries()]
    .sort((a, b) => Number(a[0] === "(inconnu)") - Number(b[0] === "(inconnu)"))
    .map(([, f]) => f);

  const out: T[] = [];
  for (let i = 0; out.length < n && ordered.some((f) => f.length > i); i++) {
    for (const f of ordered) {
      if (out.length >= n) break;
      if (f[i]) out.push(f[i]);
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────────
 * Partie BASE
 * ──────────────────────────────────────────────────────────── */

/** Colonnes du prospect nécessaires à l'affichage de la sélection (M1 compris). */
const PROSPECT_COLS =
  "id, username, full_name, bio, category, metier, profession_ia, ville, booking_platform, " +
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
}

interface AccountLite {
  id: string;
  username: string;
  status: AccountStatus;
  started_at: string;
}

async function loadAccount(accountId?: string): Promise<AccountLite> {
  const q = supabase.from("ig_accounts").select("id, username, status, started_at");
  const { data, error } = accountId
    ? await q.eq("id", accountId).limit(1)
    : await q.order("created_at", { ascending: true }).limit(1);
  if (error) throw new Error(error.message);
  const a = data?.[0] as AccountLite | undefined;
  if (!a) throw new Error("Aucun compte émetteur configuré (ig_accounts).");
  return a;
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

  if (missing > 0) {
    const { fresh, stock } = await pickFreshProspects(missing, now);
    stockLeft = Math.max(0, stock - fresh.length);
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
  const stillActive = rows.filter((r) => !r.skipped_at).length;
  return {
    day,
    accountId: account.id,
    slots,
    rows,
    carried,
    shortfall: Math.max(0, slots - stillActive),
    stockLeft,
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

/**
 * Meilleurs prospects encore jamais sélectionnés, filtrés qualité puis mixés
 * par métier. On sur-récupère (×6) car les filtres qualité qui ne s'expriment
 * pas en SQL (hors-cible, activité) se jouent côté JS.
 */
async function pickFreshProspects(n: number, now: Date): Promise<{ fresh: Selectable[]; stock: number }> {
  const { data: already } = await supabase.from("ig_daily_selection").select("prospect_id").limit(50_000);
  const served = new Set((already ?? []).map((r) => r.prospect_id as string));

  const { data, error } = await supabase
    .from("instagram_prospects")
    .select(PROSPECT_COLS)
    .eq("status", "todo")
    .eq("qualification", "qualified")
    .is("stage", null)
    // `followers <= N` vaut NULL en SQL pour un compte sans nombre d'abonnés et
    // l'exclurait : on garde ces comptes, `isSelectable` les accepte aussi.
    .or(`followers.lte.${MAX_FOLLOWERS},followers.is.null`)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(Math.max(200, n * 6));
  if (error) throw new Error(error.message);

  const pool = ((data ?? []) as unknown as Selectable[]).filter(
    (p) => !served.has(p.id) && isSelectable(p, now.getTime()),
  );
  return { fresh: roundRobinByMetier(pool, n), stock: pool.length };
}

/** Compte les prospects qualifiés jamais sélectionnés (jauge de stock du cockpit). */
export async function countAvailableStock(now = new Date()): Promise<number> {
  const { stock } = await pickFreshProspects(0, now);
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
export async function markLostFromSelection(prospectId: string, reason: string | null, now = new Date()): Promise<void> {
  const { error: proErr } = await supabase
    .from("instagram_prospects")
    .update({ stage: "perdu", status: "negative", next_followup_at: null })
    .eq("id", prospectId);
  if (proErr) throw new Error(`prospect : ${proErr.message}`);

  // La ligne du jour est écartée, pas supprimée : elle reste visible, grisée,
  // et ne sera pas reportée demain.
  const { error: selErr } = await supabase
    .from("ig_daily_selection")
    .update({ skipped_at: now.toISOString(), skip_reason: reason ?? "perdu — injoignable" })
    .eq("prospect_id", prospectId)
    .is("done_at", null)
    .is("skipped_at", null);
  if (selErr) throw new Error(`sélection : ${selErr.message}`);
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
  /** Créneaux qu'il restait à pourvoir au départ, et à l'arrivée. */
  shortfallBefore: number;
  shortfallAfter: number;
  /** Pourquoi on s'est arrêté. */
  stopped: "sélection pleine" | "plus rien à faire" | "temps écoulé" | "trop de tours";
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
  /** Profils soumis à l'IA. */
  processed?: number;
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

export async function refillStock(now = new Date()): Promise<RefillRun> {
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

  for (let i = 0; i < REFILL_MAX_STEPS; i++) {
    if (Date.now() - started > REFILL_BUDGET_MS - REFILL_STEP_RESERVE_MS) {
      stopped = "temps écoulé";
      break;
    }
    const step = await refillStep(now, sterile);
    if (!step.ran) {
      // Plus aucune marche disponible : on garde la raison pour l'afficher.
      steps.push(step);
      stopped = "plus rien à faire";
      break;
    }
    steps.push(step);

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
  // Diagnostic des sources : on privilégie le détail d'une marche tombée sur une
  // panne (avec ses tentatives). Sinon, si la sélection reste incomplète, on
  // joint l'état courant des sources — mais UNIQUEMENT si l'une est réellement à
  // terre, pour ne pas afficher un bloc rouge quand le vrai frein est ailleurs
  // (clé Anthropic, bibliothèque de hashtags épuisée, temps écoulé).
  let diagnostic = [...steps].reverse().find((s) => s.diagnostic)?.diagnostic;
  if (!diagnostic && shortfall > 0) {
    const d = await chainDiagnostic().catch(() => undefined);
    if (d && d.providers.some((p) => !p.available)) diagnostic = d;
  }
  return {
    ran,
    reason: ran ? undefined : steps.find((s) => !s.ran)?.reason,
    steps,
    inserted: steps.reduce((n, s) => n + (s.inserted ?? 0), 0),
    qualified: steps.reduce((n, s) => n + (s.qualified ?? 0), 0),
    shortfallBefore: before.shortfall,
    shortfallAfter: shortfall,
    stopped,
    diagnostic,
  };
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
async function refillStep(now = new Date(), sterile = new Set<string>()): Promise<RefillResult> {
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
    };
  }

  // 2) Plus rien à trier : on dépile la file de pistes déjà collectées.
  //    Un LOT, pas tout : les relais RapidAPI résolvent un profil par requête à
  //    ~5 s pièce, et un scan monolithique dépassait le maxDuration de la route
  //    sans jamais rendre la main (cockpit muet, cf. migration 021).
  if (!igSourceConfigured) return { ran: false, reason: "stock trié en totalité et aucune source configurée (APIFY_TOKEN / RAPIDAPI_KEY) — scan impossible." };

  const pendingByMetier = new Map((await leadsStatus()).byMetier.map((b) => [b.metier, b.pending]));

  for (const t of targets) {
    if (!pendingByMetier.get(t.metier)) continue;
    const res = await resolveLeads(undefined, t.metier);
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
    };
  }

  // 3) File vide : on la réalimente. Bon marché (1 requête ≈ 30 pistes) et
  //    instantané — la résolution attendra le prochain tour.
  for (const t of targets) {
    const hashtag = await nextHashtagFor(t.metier);
    if (!hashtag) continue;
    try {
      const got = await collectLeads(hashtag, t.metier);
      // `scans` est le compteur qui pilote le tourniquet pondéré : sans cette
      // incrémentation la cible reste éternellement la moins servie et monopolise
      // tous les tours. Lu-puis-écrit sans verrou — le refill a un seul appelant
      // (le cron), et deux tours simultanés ne coûteraient qu'un passage en trop.
      await supabase
        .from("ig_hunt_targets")
        .update({ last_scan_at: now.toISOString(), scans: (t.scans ?? 0) + 1 })
        .eq("id", t.id);
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
