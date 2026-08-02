// File de pistes Instagram — découverte et résolution découplées.
//
// Le scan monolithique d'avant ne pouvait plus marcher sur les relais RapidAPI :
// ils résolvent UN profil par requête, à ~5 s pièce. 60 profils = 5 min = le
// maxDuration de la route, donc un appel qui meurt sans rien rendre.
//
// Découpage :
//   1. `collectLeads()`  — 1 à 2 requêtes, empile ~30 owner ids dans `ig_leads`.
//      Instantané, quasi gratuit, c'est lui qui « fait la base ».
//   2. `resolveLeads()`  — dépile un petit lot et le transforme en prospects.
//      Borné en nombre ET en temps : rend toujours la main avant le timeout.
//
// Chaque étape est idempotente : relancée, elle reprend là où elle en était.

import { supabase } from "./supabase";
import { discoverHashtagUsernames, fetchProfiles } from "./igSource";
import { generateMetierHashtags } from "./hashtags";
import { lastQuota } from "./igProviders/rapidapi";
import { saveQuota, loadQuota } from "./igProviders/state";
import { isProspect, detectMetier, detectVille, detectBookingPlatform, pickContact, extractLastPostAt, prospectScore } from "./instagram";

/**
 * Réglages de débit, déduits du plan réellement souscrit.
 *
 * Le fournisseur annonce son plafond mensuel dans ses en-têtes (150 = gratuit,
 * 15 000 = Pro). On s'y accroche plutôt que de coder un palier en dur : le jour
 * où l'abonnement change, le rythme suit tout seul, sans variable à penser.
 *
 * Gratuit : 1000 req/h, soit 0,28/s — au-delà de 4 en parallèle on frôle le
 * plafond horaire pour rien, puisque le crédit mensuel s'épuise avant.
 * Pro : 10 req/s — le débit n'est plus la contrainte, on peut charger le lot.
 */
const TUNING = { free: { batch: 12, concurrency: 4 }, pro: { batch: 100, concurrency: 10 } };

export async function tuning(): Promise<{ batch: number; concurrency: number }> {
  const q = lastQuota("looter") ?? (await loadQuota("looter"));
  const base = q && q.limit > 1000 ? TUNING.pro : TUNING.free;
  return {
    batch: Math.max(1, Number(process.env.IG_RESOLVE_BATCH) || base.batch),
    concurrency: Math.max(1, Number(process.env.IG_RESOLVE_CONCURRENCY) || base.concurrency),
  };
}

/** Lot par défaut hors contexte (le vrai est calculé par `tuning()`). */
export const RESOLVE_BATCH = Math.max(1, Number(process.env.IG_RESOLVE_BATCH) || TUNING.free.batch);
/** Sécurité temps : on s'arrête net au-delà, même lot inachevé. */
const RESOLVE_BUDGET_MS = 120_000;
/** Une piste qui échoue 3 fois est abandonnée (compte supprimé, privé…). */
const MAX_ATTEMPTS = 3;

export interface CollectResult {
  hashtag: string;
  metier: string | null;
  /** Pistes remontées par la source. */
  found: number;
  /** Nouvelles, réellement mises en file. */
  queued: number;
  /** Déjà connues (en file ou déjà prospects). */
  known: number;
  provider: string;
  /** Curseur d'où cette passe est repartie (null = début du flux). */
  resumedFrom?: string | null;
  /** Curseur à rejouer la prochaine fois. */
  nextCursor?: string | null;
  /** true = flux terminé, ce hashtag ne sera plus proposé. */
  exhausted?: boolean;
}

export interface ResolveResult {
  attempted: number;
  inserted: number;
  skipped: number;
  failed: number;
  /** Pistes encore en attente après ce lot. */
  pending: number;
  timeUp: boolean;
  /**
   * Renseigné quand le lot s'est arrêté parce que la source est tombée (quota
   * épuisé, abo manquant, aucune source dispo) — sert à afficher le vrai motif
   * à l'écran plutôt qu'un « 0 prospect » muet.
   */
  stopReason?: string;
}

/* ────────────────────────────────────────────────────────────
 * 1. Collecte — bon marché, on peut l'appeler souvent
 * ──────────────────────────────────────────────────────────── */

/**
 * Prochain hashtag à scanner pour ce métier — par ROTATION, pas par
 * consommation.
 *
 * Un hashtag n'est plus jeté après une passe : on garde son curseur et on y
 * revient plus tard, là où on s'était arrêté. L'ordre est donc : les jamais
 * scannés d'abord (matière neuve), puis le plus anciennement scanné. Seuls les
 * hashtags dont le fournisseur a annoncé la fin du flux sortent définitivement.
 */
export async function nextHashtagFor(metier: string): Promise<string | null> {
  const tags = generateMetierHashtags(metier, { includeTransversal: false }).map((r) => r.hashtag);
  if (!tags.length) return null;

  const { data, error } = await supabase
    .from("ig_hashtag_cursors")
    .select("hashtag, exhausted, last_scan_at")
    .in("hashtag", tags);
  if (error) {
    // Migration 022 non appliquée : on retombe sur le comportement d'avant.
    console.error("[igLeads] rotation des hashtags indisponible:", error.message);
    return tags[0] ?? null;
  }

  const known = new Map((data ?? []).map((r) => [r.hashtag as string, r]));
  const virgin = tags.find((h) => !known.has(h));
  if (virgin) return virgin;

  const openable = tags
    .map((h) => known.get(h)!)
    .filter((r) => !r.exhausted)
    .sort((a, b) => String(a.last_scan_at ?? "").localeCompare(String(b.last_scan_at ?? "")));
  return (openable[0]?.hashtag as string) ?? null;
}

/** Point de reprise mémorisé pour ce hashtag (null = repartir du début). */
async function cursorOf(hashtag: string): Promise<string | null> {
  const { data } = await supabase.from("ig_hashtag_cursors").select("cursor").eq("hashtag", hashtag).maybeSingle();
  return (data?.cursor as string) ?? null;
}

/**
 * Empile les comptes d'un hashtag dans la file, sans résoudre aucun profil.
 * `limit` = nombre de posts scannés (≈ autant de pistes, dédupliquées).
 */
export async function collectLeads(hashtag: string, metier: string | null = null, limit = 30): Promise<CollectResult> {
  const tag = (hashtag ?? "").replace(/^#/, "").trim();
  if (!tag) throw new Error("hashtag requis");

  // resolveCap 0 : on veut les ids bruts, surtout pas payer la résolution ici.
  // Le curseur reprend la lecture où la passe précédente s'est arrêtée.
  const from = await cursorOf(tag);
  const src = await discoverHashtagUsernames(tag, limit, { resolveCap: 0, cursor: from });
  const ids = src.candidateIds ?? [];
  // Apify, lui, donne les usernames directement : ces comptes n'ont pas besoin
  // de la file, ils vont droit en résolution par username.
  if (!ids.length && src.usernames.length) {
    await persistQuota();
    const inserted = await insertProfiles(src.usernames, tag, metier);
    // Pas de curseur chez Apify, mais on horodate quand même : sans ça le
    // hashtag resterait « jamais scanné » et la rotation le rejouerait sans fin.
    await saveCursor(tag, metier, null, false, inserted);
    return {
      hashtag: tag,
      metier,
      found: src.usernames.length,
      queued: inserted,
      known: src.usernames.length - inserted,
      provider: src.provider,
      resumedFrom: from,
      nextCursor: null,
      exhausted: false,
    };
  }

  await persistQuota();
  const fresh = await unknownIds(ids);
  if (fresh.length) {
    const { error } = await supabase.from("ig_leads").upsert(
      fresh.map((id) => ({ ig_user_id: id, hashtag_source: tag, metier })),
      { onConflict: "ig_user_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(`mise en file impossible : ${error.message}`);
  }
  await saveCursor(tag, metier, src.nextCursor, src.exhausted, fresh.length);
  return {
    hashtag: tag,
    metier,
    found: ids.length,
    queued: fresh.length,
    known: ids.length - fresh.length,
    provider: src.provider,
    resumedFrom: from,
    nextCursor: src.nextCursor,
    exhausted: src.exhausted,
  };
}

/**
 * Enregistre le point de reprise. Le compteur de pages et de pistes s'accumule :
 * il dit ce qu'un hashtag a réellement rapporté, donc lesquels valent la peine.
 */
async function saveCursor(
  hashtag: string,
  metier: string | null,
  cursor: string | null,
  exhausted: boolean,
  found: number,
): Promise<void> {
  const { data: prev } = await supabase
    .from("ig_hashtag_cursors")
    .select("pages_done, leads_found")
    .eq("hashtag", hashtag)
    .maybeSingle();
  const { error } = await supabase.from("ig_hashtag_cursors").upsert(
    {
      hashtag,
      metier,
      cursor,
      exhausted,
      pages_done: ((prev?.pages_done as number) ?? 0) + 1,
      leads_found: ((prev?.leads_found as number) ?? 0) + found,
      last_scan_at: new Date().toISOString(),
    },
    { onConflict: "hashtag" },
  );
  if (error) console.error("[igLeads] curseur non enregistré:", error.message);
}

/** Ids ni déjà en file, ni déjà prospects. */
async function unknownIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const [{ data: queued }, { data: prospects }] = await Promise.all([
    supabase.from("ig_leads").select("ig_user_id").in("ig_user_id", ids),
    supabase.from("instagram_prospects").select("ig_user_id").in("ig_user_id", ids),
  ]);
  const seen = new Set<string>();
  for (const r of queued ?? []) seen.add(r.ig_user_id as string);
  for (const r of prospects ?? []) if (r.ig_user_id) seen.add(r.ig_user_id as string);
  return ids.filter((id) => !seen.has(id));
}

/* ────────────────────────────────────────────────────────────
 * 2. Résolution — coûteuse, strictement bornée
 * ──────────────────────────────────────────────────────────── */

/** Transforme un petit lot de pistes en prospects. Rend toujours la main. */
export async function resolveLeads(limit?: number, metier?: string | null): Promise<ResolveResult> {
  const started = Date.now();
  const tune = await tuning();
  limit = limit ?? tune.batch;
  let q = supabase
    .from("ig_leads")
    .select("ig_user_id, hashtag_source, metier, attempts")
    .is("resolved_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("discovered_at", { ascending: true })
    .limit(limit);
  if (metier) q = q.eq("metier", metier);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const leads = (data ?? []) as Array<{ ig_user_id: string; hashtag_source: string | null; metier: string | null; attempts: number }>;

  let inserted = 0;
  let failed = 0;
  let attempted = 0;
  let timeUp = false;
  let stop = false; // quota mort ou temps écoulé : plus rien ne démarre
  let stopReason: string | undefined; // motif source quand on coupe le lot

  const queue = [...leads];
  const worker = async () => {
    for (;;) {
      if (stop || Date.now() - started > RESOLVE_BUDGET_MS) {
        if (queue.length) timeUp = true;
        return;
      }
      const lead = queue.shift();
      if (!lead) return;
      attempted++;
      try {
        const [profile] = await fetchProfiles([lead.ig_user_id], "id");
        if (!profile) {
          // Compte supprimé/privé : on incrémente, il sortira de la file au 3e essai.
          failed++;
          await supabase.from("ig_leads").update({ attempts: lead.attempts + 1, last_error: "profil introuvable" }).eq("ig_user_id", lead.ig_user_id);
          continue;
        }
        if (await insertProfile(profile, lead.hashtag_source ?? "", lead.metier)) inserted++;
        await supabase
          .from("ig_leads")
          .update({ resolved_at: new Date().toISOString(), username: profile.username })
          .eq("ig_user_id", lead.ig_user_id);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from("ig_leads").update({ attempts: lead.attempts + 1, last_error: msg.slice(0, 300) }).eq("ig_user_id", lead.ig_user_id);
        // Quota épuisé / source à terre : insister brûlerait le reste du lot.
        if (/quota|auth|Aucune source/i.test(msg)) {
          stop = true;
          timeUp = true;
          stopReason = msg;
          return;
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(tune.concurrency, leads.length) }, worker));
  await persistQuota();

  const { count } = await supabase
    .from("ig_leads")
    .select("*", { count: "exact", head: true })
    .is("resolved_at", null)
    .lt("attempts", MAX_ATTEMPTS);

  return { attempted, inserted, skipped: attempted - inserted - failed, failed, pending: count ?? 0, timeUp, stopReason };
}

/* ────────────────────────────────────────────────────────────
 * Insertion — même normalisation que igDiscover (source unique de vérité)
 * ──────────────────────────────────────────────────────────── */

async function insertProfiles(usernames: string[], hashtag: string, metier: string | null): Promise<number> {
  const profiles = await fetchProfiles(usernames);
  let n = 0;
  for (const p of profiles) if (await insertProfile(p, hashtag, metier)) n++;
  return n;
}

/** true = nouvelle ligne écrite. */
async function insertProfile(p: Awaited<ReturnType<typeof fetchProfiles>>[number], hashtag: string, metier: string | null): Promise<boolean> {
  const prospect = isProspect(p);
  const { email, phone } = pickContact(p);
  const lastPostAt = extractLastPostAt(p);
  const { score, tier } = prospectScore({
    has_website: !prospect,
    last_post_at: lastPostAt,
    followers: typeof p.followersCount === "number" ? p.followersCount : null,
    email,
    phone,
    is_business: typeof p.isBusinessAccount === "boolean" ? p.isBusinessAccount : null,
    bio: p.biography ?? null,
  });
  const row = {
    username: p.username,
    ig_user_id: typeof p.igUserId === "string" ? p.igUserId : null,
    full_name: p.fullName ?? null,
    bio: p.biography ?? null,
    external_url: p.externalUrl ?? null,
    followers: typeof p.followersCount === "number" ? p.followersCount : null,
    follows_count: typeof p.followsCount === "number" ? p.followsCount : null,
    posts_count: typeof p.postsCount === "number" ? p.postsCount : null,
    category: p.businessCategoryName ?? null,
    // Le métier de la cible de chasse fait foi ; la détection ne sert qu'en repli.
    metier: metier || detectMetier(p.businessCategoryName, p.biography),
    ville: detectVille(hashtag, p.biography),
    booking_platform: detectBookingPlatform(p.externalUrl, p.biography),
    email,
    phone,
    is_business: typeof p.isBusinessAccount === "boolean" ? p.isBusinessAccount : null,
    verified: typeof p.verified === "boolean" ? p.verified : null,
    has_website: !prospect,
    profile_pic_url: typeof p.profilePicUrl === "string" ? p.profilePicUrl : null,
    raw: p,
    hashtag_source: hashtag,
    last_post_at: lastPostAt,
    score,
    score_tier: tier,
  };
  const { data, error } = await supabase
    .from("instagram_prospects")
    .upsert(row, { onConflict: "username", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("[igLeads] insertion refusée:", error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/* ────────────────────────────────────────────────────────────
 * État de la file, pour le cockpit
 * ──────────────────────────────────────────────────────────── */

export interface LeadsStatus {
  pending: number;
  resolved: number;
  abandoned: number;
  byMetier: Array<{ metier: string; pending: number }>;
  quota: { provider: string; limit: number; remaining: number } | null;
}

export async function leadsStatus(): Promise<LeadsStatus> {
  const head = { count: "exact" as const, head: true };
  const [pending, resolved, abandoned, rows] = await Promise.all([
    supabase.from("ig_leads").select("*", head).is("resolved_at", null).lt("attempts", MAX_ATTEMPTS),
    supabase.from("ig_leads").select("*", head).not("resolved_at", "is", null),
    supabase.from("ig_leads").select("*", head).is("resolved_at", null).gte("attempts", MAX_ATTEMPTS),
    supabase.from("ig_leads").select("metier").is("resolved_at", null).lt("attempts", MAX_ATTEMPTS).limit(2000),
  ]);

  const tally = new Map<string, number>();
  for (const r of (rows.data ?? []) as Array<{ metier: string | null }>) {
    const k = r.metier || "—";
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }

  // En mémoire si un appel vient d'avoir lieu, sinon le dernier connu en base.
  const live = lastQuota("looter");
  const quota = live ? { limit: live.limit, remaining: live.remaining } : await loadQuota("looter");

  return {
    pending: pending.count ?? 0,
    resolved: resolved.count ?? 0,
    abandoned: abandoned.count ?? 0,
    byMetier: [...tally].map(([metier, n]) => ({ metier, pending: n })).sort((a, b) => b.pending - a.pending),
    quota: quota ? { provider: "looter", ...quota } : null,
  };
}

/** Enregistre le quota vu pendant l'opération qui vient de se terminer. */
async function persistQuota(): Promise<void> {
  const q = lastQuota("looter");
  if (q) await saveQuota("looter", q);
}
