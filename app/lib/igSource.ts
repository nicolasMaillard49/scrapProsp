// Source de données Instagram — chaîne de priorité avec bascule automatique.
//
// Ordre par défaut : apify → looter → stable (surchargeable par IG_PROVIDER_ORDER).
// Apify reste primaire : il donne les usernames directement et son actor profil
// ramène les posts récents. Les deux APIs RapidAPI prennent le relais dès que
// les crédits Apify du mois sont épuisés (402/403) ou que l'actor tombe.
//
// Trois garde-fous, parce qu'un fallback gratuit se grille en un scan :
//  1. dédup par `ig_user_id` avant toute résolution payante ;
//  2. plafond de résolutions par scan (IG_RESOLVE_CAP, défaut 60) ;
//  3. cache des profils déjà résolus, pour que fetchProfiles() ne repaie pas ce
//     que la découverte vient d'obtenir.

import { supabase, supabaseConfigured } from "./supabase";
import { apifyProvider } from "./igProviders/apify";
import { looterProvider, stableProvider } from "./igProviders/rapidapi";
import { disabledProviders, markFailure, markSuccess } from "./igProviders/state";
import { iglog } from "./igProviders/log";
import { ProviderError, type HashtagPage, type IgProfile, type IgProvider } from "./igProviders/types";

export type { IgProfile } from "./igProviders/types";

const ALL: IgProvider[] = [apifyProvider, looterProvider, stableProvider];

/**
 * Nombre max de profils résolus par scan chez un provider qui ne donne que des
 * ids. Relu à chaque appel (et non figé au chargement) pour que `igLeads` puisse
 * demander 0 résolution — il ne veut que les ids bruts.
 */
const resolveCap = () => {
  const v = Number(process.env.IG_RESOLVE_CAP);
  // 12 et pas 60 : à ~5 s la résolution, 60 profils = 5 min = le maxDuration
  // des routes. Le scan direct (`/api/instagram/discover`, mode avancé) doit
  // rendre la main comme le reste ; pour du volume, c'est la file de pistes.
  return Number.isFinite(v) && v >= 0 ? v : 12;
};
const PROFILE_CACHE_MAX = 800;

/** Au moins une source utilisable : sinon la découverte est impossible. */
export const igSourceConfigured = ALL.some((p) => p.configured);
/** Conservé pour les messages d'erreur qui parlaient d'Apify nommément. */
export const apifyConfigured = apifyProvider.configured;

// Résumé de config au chargement du module : la toute première chose à lire
// dans les logs Vercel. Dit sans ambiguïté quelles sources ont leurs
// credentials — si `looter`/`stable` sont NON alors que la clé RapidAPI est
// bien dans Vercel, c'est que la variable n'est pas dans le bon environnement
// (Production vs Preview) ou que le déploiement date d'avant son ajout.
iglog("step", "config", "🚀 Sources Instagram chargées", {
  sources: ALL.map((p) => `${p.name}=${p.configured ? "oui" : "NON"}`),
  ordre: order().map((p) => p.name).join(" → "),
});

function order(): IgProvider[] {
  const raw = (process.env.IG_PROVIDER_ORDER ?? "").trim();
  if (!raw) return ALL;
  const wanted = raw.split(/[,\s]+/).filter(Boolean);
  const byName = new Map(ALL.map((p) => [p.name, p]));
  const picked = wanted.map((n) => byName.get(n)).filter((p): p is IgProvider => !!p);
  return picked.length ? picked : ALL;
}

/* ────────────────────────────────────────────────────────────
 * Cache des profils (mémoire, borné, FIFO)
 * ──────────────────────────────────────────────────────────── */

const profileCache = new Map<string, IgProfile>();

function cacheProfiles(profiles: IgProfile[]): void {
  for (const p of profiles) {
    if (!p?.username) continue;
    profileCache.set(p.username, p);
  }
  while (profileCache.size > PROFILE_CACHE_MAX) {
    const oldest = profileCache.keys().next().value;
    if (oldest === undefined) break;
    profileCache.delete(oldest);
  }
}

/* ────────────────────────────────────────────────────────────
 * Exécution d'une opération le long de la chaîne
 * ──────────────────────────────────────────────────────────── */

interface Attempt {
  provider: string;
  kind: string;
  message: string;
}

/**
 * Exécute `run` sur le premier provider capable et disponible, en descendant la
 * chaîne à chaque panne. Un `rate_limit` ou un `transient` donne droit à une
 * seule reprise sur place avant la bascule — au-delà, changer de source est
 * plus rapide que d'attendre.
 */
async function runChain<T>(
  op: string,
  supports: (p: IgProvider) => boolean,
  run: (p: IgProvider) => Promise<T>,
  isEmpty?: (v: T) => boolean,
): Promise<{ value: T; provider: string; attempts: Attempt[] }> {
  const disabled = await disabledProviders();
  const attempts: Attempt[] = [];
  const chain = order().filter(supports);
  let lastEmpty: { value: T; provider: string } | null = null;

  // Photo de la chaîne AVANT le premier appel : c'est ici qu'on voit d'un coup
  // d'œil si le fallback est utilisable (configuré ? écarté ?) — le point de
  // diagnostic n°1 quand « ça repart tout le temps sur Apify ».
  iglog("step", "chain", `▶️ ${op} — ordre: ${chain.map((p) => p.name).join(" → ") || "(aucune source)"}`, {
    configuré: chain.map((p) => `${p.name}=${p.configured ? "oui" : "NON"}`),
    écartés: [...disabled.entries()].map(([n, s]) => `${n}(${s.lastKind ?? "?"} jusqu'à ${new Date(s.disabledUntil).toISOString()})`),
  });

  for (const p of chain) {
    if (!p.configured) {
      iglog("warn", "chain", `⏭️  ${p.name} SAUTÉ — credentials absents (clé/token manquant)`);
      attempts.push({ provider: p.name, kind: "unconfigured", message: "credentials absents" });
      continue;
    }
    const off = disabled.get(p.name);
    if (off) {
      iglog("warn", "chain", `⏭️  ${p.name} SAUTÉ — écarté jusqu'à ${new Date(off.disabledUntil).toISOString()}`, {
        cause: off.lastKind,
        détail: off.lastError,
      });
      attempts.push({
        provider: p.name,
        kind: off.lastKind ?? "disabled",
        message: `écarté jusqu'à ${new Date(off.disabledUntil).toISOString()} (${off.lastError ?? "panne précédente"})`,
      });
      continue;
    }

    for (let tryNo = 0; tryNo < 2; tryNo++) {
      iglog("info", "chain", `🎯 ${op} → essai ${p.name} (tentative ${tryNo + 1}/2)`);
      try {
        const value = await run(p);
        // Une source qui répond « rien » sur un hashtag est presque toujours
        // cassée plutôt que vide : on garde le résultat sous le coude et on
        // laisse la suivante tenter sa chance.
        if (isEmpty?.(value)) {
          iglog("warn", "chain", `∅ ${p.name} a répondu VIDE sur ${op} — on tente la source suivante`);
          attempts.push({ provider: p.name, kind: "empty", message: "aucun résultat" });
          lastEmpty ??= { value, provider: p.name };
          break;
        }
        iglog("ok", "chain", `${op} SERVI par ${p.name}`);
        await markSuccess(p.name);
        return { value, provider: p.name, attempts };
      } catch (e) {
        const err =
          e instanceof ProviderError ? e : new ProviderError(p.name, "transient", e instanceof Error ? e.message : String(e));
        const retryable = err.kind === "rate_limit" || err.kind === "transient";
        if (retryable && tryNo === 0) {
          iglog("warn", "chain", `↻ ${p.name} erreur ${err.kind} (retry dans ${err.kind === "rate_limit" ? "2s" : "1s"})`, {
            status: err.status,
            message: err.message,
          });
          await new Promise((r) => setTimeout(r, err.kind === "rate_limit" ? 2_000 : 1_000));
          continue;
        }
        iglog("err", "chain", `${p.name} KO (${err.kind}) → BASCULE vers la source suivante`, {
          status: err.status,
          message: err.message,
        });
        attempts.push({ provider: p.name, kind: err.kind, message: err.message });
        await markFailure(p.name, err.kind, err.message);
        break;
      }
    }
  }

  if (lastEmpty) {
    iglog("warn", "chain", `⚠️ ${op} — aucune source « pleine », on rend le résultat vide de ${lastEmpty.provider}`, { attempts });
    return { value: lastEmpty.value, provider: lastEmpty.provider, attempts };
  }
  iglog("err", "chain", `💥 AUCUNE source Instagram disponible pour ${op} — voici le détail de chaque tentative :`, { attempts });
  throw new Error(
    `Aucune source Instagram disponible pour ${op}. ` + attempts.map((a) => `${a.provider}: ${a.kind} — ${a.message}`).join(" | "),
  );
}

/* ────────────────────────────────────────────────────────────
 * Découverte par hashtag
 * ──────────────────────────────────────────────────────────── */

export interface HashtagSource {
  usernames: string[];
  /**
   * Ids Instagram bruts remontés par le feed, résolus ou non. C'est la matière
   * première de la file de pistes (`igLeads`) : avec IG_RESOLVE_CAP=0 on ne
   * paie aucune résolution et on ne récupère que ça.
   */
  candidateIds: string[];
  /** Point de reprise à rejouer au prochain scan de ce hashtag. */
  nextCursor: string | null;
  /** true = flux du hashtag arrivé à son terme, inutile d'y revenir. */
  exhausted: boolean;
  /** Provider ayant fourni les candidats. */
  provider: string;
  /** Provider ayant résolu les ids en usernames (RapidAPI uniquement). */
  resolver?: string;
  /** Comptes déjà en base reconnus par leur id, donc résolus gratuitement. */
  reused: number;
  /** Profils payés pour obtenir leur username. */
  resolved: number;
  /** true = le plafond IG_RESOLVE_CAP a coupé la résolution. */
  capped: boolean;
  attempts: Attempt[];
}

/** Usernames déjà connus pour ces ids Instagram — évite de payer leur résolution. */
async function knownByIgUserId(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!supabaseConfigured || !ids.length) return out;
  const { data, error } = await supabase.from("instagram_prospects").select("username, ig_user_id").in("ig_user_id", ids);
  if (error) {
    // Colonne absente (migration 020 non appliquée) : on paie la résolution,
    // ça marche quand même.
    if (!/column .* does not exist/i.test(error.message)) console.error("[igSource] dédup par ig_user_id impossible:", error.message);
    return out;
  }
  for (const row of data ?? []) {
    const id = row.ig_user_id as string | null;
    const u = row.username as string | null;
    if (id && u) out.set(id, u);
  }
  return out;
}

/**
 * Comptes ayant posté sous un hashtag. `limit` = nombre de posts à scanner.
 *
 * Apify renvoie les usernames directement. Les providers RapidAPI ne donnent
 * que des ids : on retire ceux déjà connus, puis on en résout au plus
 * IG_RESOLVE_CAP — les profils obtenus au passage sont mis en cache pour que
 * l'étape suivante (fetchProfiles) ne les repaie pas.
 */
export async function discoverHashtagUsernames(
  hashtag: string,
  limit: number,
  opts?: { resolveCap?: number; cursor?: string | null },
): Promise<HashtagSource> {
  const cap = opts?.resolveCap ?? resolveCap();
  iglog("info", "discover", `#${hashtag} — découverte (limit=${limit}, resolveCap=${cap}, cursor=${opts?.cursor ? "oui" : "non"})`);
  const { value: page, provider, attempts } = await runChain<HashtagPage>(
    `hashtag #${hashtag}`,
    (p) => typeof p.hashtagCandidates === "function",
    (p) => p.hashtagCandidates!(hashtag, limit, opts?.cursor ?? null),
    (v) => v.candidates.length === 0,
  );
  iglog("info", "discover", `#${hashtag} — ${page.candidates.length} candidat(s) via ${provider}`, {
    exhausted: page.exhausted,
    nextCursor: page.nextCursor ? "oui" : "non",
  });
  const candidates = page.candidates;
  const cursorInfo = { nextCursor: page.nextCursor, exhausted: page.exhausted };

  const direct: string[] = [];
  const ids: string[] = [];
  for (const c of candidates) {
    if (c.username) direct.push(c.username);
    else if (c.igUserId) ids.push(c.igUserId);
  }
  if (!ids.length) {
    return { usernames: direct, candidateIds: [], ...cursorInfo, provider, reused: 0, resolved: 0, capped: false, attempts };
  }

  const known = await knownByIgUserId(ids);
  const unknown = ids.filter((id) => !known.has(id));
  const budget = Math.max(0, Math.min(unknown.length, cap, Math.max(limit - direct.length - known.size, 0)));
  const toResolve = unknown.slice(0, budget);

  iglog("info", "discover", `#${hashtag} — ${ids.length} id(s), ${known.size} déjà connu(s), ${toResolve.length} à résoudre (budget=${budget}, cap=${cap})`);

  let resolver: string | undefined;
  const resolvedProfiles: IgProfile[] = [];
  if (toResolve.length) {
    const res = await runChain<IgProfile[]>(
      `résolution de ${toResolve.length} id(s)`,
      (p) => typeof p.profilesById === "function",
      (p) => p.profilesById!(toResolve),
    ).catch((e) => {
      // La découverte a réussi : on rend ce qu'on a plutôt que tout perdre.
      iglog("err", "discover", `#${hashtag} — résolution des ids IMPOSSIBLE`, { message: e instanceof Error ? e.message : String(e) });
      return null;
    });
    if (res) {
      resolver = res.provider;
      resolvedProfiles.push(...res.value);
      cacheProfiles(res.value);
    }
  }
  const usernames = [...direct, ...known.values(), ...resolvedProfiles.map((p) => p.username)];
  const seen = new Set<string>();
  return {
    usernames: usernames.filter((u) => u && !seen.has(u) && (seen.add(u), true)),
    candidateIds: ids,
    ...cursorInfo,
    provider,
    resolver,
    reused: known.size,
    resolved: resolvedProfiles.length,
    capped: unknown.length > toResolve.length,
    attempts,
  };
}

/** Compat : ancienne signature, sans les métadonnées de source. */
export async function fetchHashtagUsernames(hashtag: string, limit: number): Promise<string[]> {
  return (await discoverHashtagUsernames(hashtag, limit)).usernames;
}

/* ────────────────────────────────────────────────────────────
 * Profils
 * ──────────────────────────────────────────────────────────── */

/**
 * Profils détaillés, par username (défaut) ou par id Instagram.
 *
 * Les comptes déjà résolus pendant la découverte sont servis depuis le cache —
 * sans quoi un scan via RapidAPI paierait deux fois le même profil (une fois
 * pour le username, une fois pour les détails). Le cache par id n'existe que
 * pour la durée de l'invocation, comme celui par username.
 */
export async function fetchProfiles(keys: string[], by: "username" | "id" = "username"): Promise<IgProfile[]> {
  if (!keys.length) return [];
  const cached: IgProfile[] = [];
  const missing: string[] = [];
  for (const k of keys) {
    const hit = by === "username" ? profileCache.get(k) : [...profileCache.values()].find((p) => p.igUserId === k);
    if (hit) cached.push(hit);
    else missing.push(k);
  }
  iglog("info", "profils", `${keys.length} demandé(s) par ${by} — ${cached.length} en cache, ${missing.length} à récupérer`);
  if (!missing.length) return cached;

  const { value, provider } = await runChain<IgProfile[]>(
    `profils ${by} (${missing.length})`,
    (p) => (by === "id" ? typeof p.profilesById === "function" : true),
    (p) => (by === "id" ? p.profilesById!(missing) : p.profilesByUsername(missing)),
  );
  iglog("ok", "profils", `${value.length}/${missing.length} profil(s) récupéré(s) via ${provider}`);
  cacheProfiles(value);
  return [...cached, ...value];
}

/** État courant de la chaîne — pour les récaps opérationnels. */
export async function sourceStatus(): Promise<Array<{ provider: string; configured: boolean; available: boolean; reason?: string }>> {
  const disabled = await disabledProviders();
  return order().map((p) => {
    const off = disabled.get(p.name);
    return {
      provider: p.name,
      configured: p.configured,
      available: p.configured && !off,
      reason: !p.configured ? "credentials absents" : off ? `${off.lastKind ?? "panne"} — ${off.lastError ?? ""}`.trim() : undefined,
    };
  });
}
