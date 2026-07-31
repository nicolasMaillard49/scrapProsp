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
import { apifyConfigured } from "./apify";
import { qualifyAvailable } from "./igQualify";
import { discoverHashtag } from "./igDiscover";
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
}

export interface RefillResult {
  ran: boolean;
  /** « qualify » = tri IA du stock déjà scrapé ; « scan » = nouveau hashtag Apify. */
  mode?: "qualify" | "scan";
  reason?: string;
  metier?: string;
  hashtag?: string;
  scanned?: number;
  inserted?: number;
  /** Nombre de comptes passés « qualified » par l'IA sur ce run. */
  qualified?: number;
  /** Profils soumis à l'IA. */
  processed?: number;
}

/**
 * Prochain hashtag JAMAIS scanné pour ce métier. La bibliothèque de hashtags
 * métier est déterministe, et `hashtag_source` mémorise ceux déjà passés : pas
 * besoin d'état supplémentaire pour savoir où on en est.
 */
async function nextUnusedHashtag(metier: string): Promise<string | null> {
  const tags = hashtagsOf(metier);
  if (!tags.length) return null;
  const { data } = await supabase
    .from("instagram_prospects")
    .select("hashtag_source")
    .in("hashtag_source", tags)
    .limit(10_000);
  const used = new Set((data ?? []).map((r) => r.hashtag_source as string));
  return tags.find((h) => !used.has(h)) ?? null;
}

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
export async function refillStock(now = new Date()): Promise<RefillResult> {
  if (!qualifyAvailable()) return { ran: false, reason: "ANTHROPIC_API_KEY manquant — qualification impossible." };

  const { data, error } = await supabase
    .from("ig_hunt_targets")
    .select("id, metier, avatar_profession, min_followers, max_followers, last_scan_at")
    .eq("active", true)
    .order("last_scan_at", { ascending: true, nullsFirst: true })
    .limit(10);
  if (error) throw new Error(error.message);
  const targets = (data ?? []) as HuntTarget[];
  if (!targets.length) return { ran: false, reason: "Aucune cible de chasse active (table ig_hunt_targets)." };

  // 1) Le moins cher d'abord : trier ce qui dort déjà en base sans verdict IA.
  //    `status: "todo"` est OBLIGATOIRE — sans lui le tri part sur les plus
  //    récents tous statuts confondus et ne produit que des verdicts sur des
  //    comptes déjà démarchés, qui n'entreront jamais dans la sélection.
  for (const t of targets) {
    if ((await unqualifiedCount(t.metier)) === 0) continue;
    const qual = await qualifyRun({
      scope: { metier: t.metier, hashtags: hashtagsOf(t.metier) },
      status: "todo",
      onlyUnqualified: true,
      limit: QUALIFY_RUN_CAP,
      avatar: { profession: t.avatar_profession, minFollowers: t.min_followers, maxFollowers: t.max_followers },
    });
    return {
      ran: true,
      mode: "qualify",
      metier: t.metier,
      processed: qual.processed,
      qualified: qual.qualified,
    };
  }

  // 2) Plus rien à trier : on repart en chasse sur un hashtag jamais scanné.
  if (!apifyConfigured) return { ran: false, reason: "stock trié en totalité et APIFY_TOKEN manquant — scan impossible." };

  for (const t of targets) {
    const hashtag = await nextUnusedHashtag(t.metier);
    if (!hashtag) continue;

    // Apify peut refuser (quota mensuel épuisé → 403). Ça ne doit PAS faire
    // tomber le cron du matin : on remonte la raison, le récap Telegram la dira.
    let scan;
    try {
      scan = await discoverHashtag({ hashtag, target: 100 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ran: false, reason: `scan #${hashtag} impossible — ${msg.slice(0, 160)}` };
    }
    await supabase.from("ig_hunt_targets").update({ last_scan_at: now.toISOString() }).eq("id", t.id);

    const qual = scan.inserted
      ? await qualifyRun({
          hashtag,
          onlyUnqualified: true,
          limit: Math.min(scan.inserted, QUALIFY_RUN_CAP),
          avatar: {
            profession: t.avatar_profession,
            minFollowers: t.min_followers,
            maxFollowers: t.max_followers,
          },
        })
      : null;

    return {
      ran: true,
      mode: "scan",
      metier: t.metier,
      hashtag,
      scanned: scan.scanned,
      inserted: scan.inserted,
      processed: qual?.processed ?? 0,
      qualified: qual?.qualified ?? 0,
    };
  }

  return { ran: false, reason: "Toutes les cibles ont épuisé leur bibliothèque de hashtags — ajoute des métiers dans ig_hunt_targets." };
}
