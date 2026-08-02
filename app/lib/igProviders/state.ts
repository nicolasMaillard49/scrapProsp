// Mémoire des pannes providers — pour ne pas re-taper une source déjà épuisée.
//
// Sur Vercel chaque hashtag est une invocation distincte : une variable de
// module ne survit pas d'un scan à l'autre. Sans persistance, un scan de 25
// hashtags retaperait Apify 25 fois après l'épuisement des crédits — 25 allers-
// retours perdus. L'état vit donc dans Supabase (`ig_provider_state`), avec un
// cache mémoire devant pour les appels rapprochés d'une même invocation.
//
// La table est optionnelle : si la migration 020 n'est pas appliquée, tout
// continue de fonctionner en mémoire seule (dégradé, jamais bloquant).

import { supabase, supabaseConfigured } from "../supabase";
import { iglog } from "./log";
import type { FailureKind } from "./types";

/**
 * Durée d'écartement selon la panne. Le quota est volontairement à 6 h et non
 * « jusqu'au 1er du mois » : les cycles de facturation RapidAPI démarrent à la
 * date d'abonnement, et une source rouverte doit se rétablir toute seule.
 * Retenter pour rien ne coûte qu'un aller-retour — l'inverse coûte des jours.
 */
const COOLDOWN_MS: Record<FailureKind, number> = {
  quota: 6 * 3600_000,
  auth: 24 * 3600_000,
  rate_limit: 120_000,
  transient: 60_000,
  fatal: 300_000,
};

interface ProviderState {
  disabledUntil: number; // epoch ms
  lastKind: FailureKind | null;
  lastError: string | null;
}

const memory = new Map<string, ProviderState>();
let tableMissing = false; // sentinelle : on n'insiste pas si la migration n'est pas passée

async function loadRemote(): Promise<void> {
  if (!supabaseConfigured || tableMissing) return;
  const { data, error } = await supabase.from("ig_provider_state").select("provider, disabled_until, last_kind, last_error");
  if (error) {
    // 42P01 = relation inexistante → migration 020 non appliquée.
    if (error.code === "42P01" || /does not exist/i.test(error.message)) {
      tableMissing = true;
      iglog("warn", "state", "table ig_provider_state ABSENTE (migration 020 non appliquée) — état géré en mémoire seule");
    } else {
      iglog("err", "state", "lecture état Supabase impossible", { message: error.message });
    }
    return;
  }
  const now = Date.now();
  const active = (data ?? []).filter((r) => r.disabled_until && Date.parse(r.disabled_until as string) > now);
  if (active.length) {
    iglog("warn", "state", `${active.length} provider(s) actuellement ÉCARTÉ(S) selon Supabase`, {
      détail: active.map((r) => `${r.provider}(${r.last_kind ?? "?"} jusqu'à ${r.disabled_until})`),
    });
  }
  for (const row of data ?? []) {
    const until = row.disabled_until ? Date.parse(row.disabled_until as string) : 0;
    const prev = memory.get(row.provider as string);
    // La mémoire locale est plus fraîche qu'un état distant plus ancien.
    if (!prev || until > prev.disabledUntil) {
      memory.set(row.provider as string, {
        disabledUntil: Number.isNaN(until) ? 0 : until,
        lastKind: (row.last_kind as FailureKind) ?? null,
        lastError: (row.last_error as string) ?? null,
      });
    }
  }
}

let loaded: Promise<void> | null = null;
/** Charge l'état distant une fois par instance de fonction. */
function ensureLoaded(): Promise<void> {
  if (!loaded) loaded = loadRemote().catch(() => undefined);
  return loaded;
}

/** Providers momentanément écartés, avec la raison. */
export async function disabledProviders(now = Date.now()): Promise<Map<string, ProviderState>> {
  await ensureLoaded();
  const out = new Map<string, ProviderState>();
  for (const [name, st] of memory) if (st.disabledUntil > now) out.set(name, st);
  return out;
}

/** Marque une panne et écarte le provider le temps du cooldown associé. */
export async function markFailure(provider: string, kind: FailureKind, message: string, now = Date.now()): Promise<void> {
  const disabledUntil = now + COOLDOWN_MS[kind];
  iglog("warn", "state", `⛔ ${provider} écarté ${Math.round(COOLDOWN_MS[kind] / 60000)} min (${kind}) — jusqu'à ${new Date(disabledUntil).toISOString()}`, {
    cause: message.slice(0, 160),
  });
  memory.set(provider, { disabledUntil, lastKind: kind, lastError: message.slice(0, 300) });
  if (!supabaseConfigured || tableMissing) return;
  const { error } = await supabase.from("ig_provider_state").upsert(
    {
      provider,
      disabled_until: new Date(disabledUntil).toISOString(),
      last_kind: kind,
      last_error: message.slice(0, 300),
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "provider" },
  );
  if (error) {
    if (error.code === "42P01" || /does not exist/i.test(error.message)) tableMissing = true;
    else console.error("[igProviders] écriture état impossible:", error.message);
  }
}

/** Un succès réhabilite immédiatement le provider. */
export async function markSuccess(provider: string): Promise<void> {
  const prev = memory.get(provider);
  memory.set(provider, { disabledUntil: 0, lastKind: null, lastError: null });
  if (!supabaseConfigured || tableMissing) return;
  if (!prev || prev.disabledUntil === 0) return; // rien à effacer
  iglog("ok", "state", `♻️ ${provider} réhabilité (succès) — cooldown effacé`);
  const { error } = await supabase
    .from("ig_provider_state")
    .upsert({ provider, disabled_until: null, last_kind: null, last_error: null, updated_at: new Date().toISOString() }, { onConflict: "provider" });
  if (error && (error.code === "42P01" || /does not exist/i.test(error.message))) tableMissing = true;
}

/**
 * Quota fournisseur, persisté pour que le cockpit l'affiche dès l'ouverture —
 * la mémoire d'une invocation Vercel ne survit pas au clic suivant.
 * Écrit après une opération, jamais à chaque requête (une écriture par appel
 * de scraping suffit à rester juste).
 */
export async function saveQuota(provider: string, q: { limit: number; remaining: number; resetAt: string | null }): Promise<void> {
  if (!supabaseConfigured || tableMissing) return;
  const { error } = await supabase.from("ig_provider_state").upsert(
    { provider, quota_limit: q.limit, quota_remaining: q.remaining, quota_reset_at: q.resetAt, updated_at: new Date().toISOString() },
    { onConflict: "provider" },
  );
  if (error && (error.code === "42P01" || /does not exist/i.test(error.message))) tableMissing = true;
}

export async function loadQuota(provider: string): Promise<{ limit: number; remaining: number } | null> {
  if (!supabaseConfigured || tableMissing) return null;
  const { data, error } = await supabase
    .from("ig_provider_state")
    .select("quota_limit, quota_remaining")
    .eq("provider", provider)
    .maybeSingle();
  if (error || !data?.quota_limit) return null;
  return { limit: data.quota_limit as number, remaining: (data.quota_remaining as number) ?? 0 };
}

/** Réinitialise le cache mémoire — tests uniquement. */
export function __resetStateCache(): void {
  memory.clear();
  loaded = null;
  tableMissing = false;
}
