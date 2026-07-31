// Qualification IA par lots des prospects Instagram (verdict + profession + score).
// Extrait de /api/instagram/qualify pour être réutilisable côté serveur par le
// refill automatique de la sélection du jour (`igSelection.refillStock`).

import { supabase } from "./supabase";
import { qualifyProfiles, type QualifyAvatar } from "./igQualify";
import { prospectScore } from "./instagram";

/** Profils max par run (10 lots de 40) — borne le temps et le coût Claude. */
export const QUALIFY_RUN_CAP = 400;

export interface QualifyRunOptions {
  avatar: QualifyAvatar;
  /** Filtre métier (colonne metier) — optionnel. */
  metier?: string;
  /** Filtre hashtag_source — optionnel. */
  hashtag?: string;
  /**
   * Rattachement à un métier en OU : colonne `metier` **ou** hashtag d'origine
   * dans sa bibliothèque. Indispensable pour rattraper le stock dont la colonne
   * `metier` est vide — la regex de `detectMetier` n'a rien trouvé au scan
   * (128 prospects dans ce cas au 31/07) — alors que le hashtag, lui, dit bien
   * de quel métier il s'agit. À ne pas confondre avec `metier` / `hashtag`,
   * qui se cumulent en ET.
   */
  scope?: { metier: string; hashtags: string[] };
  /**
   * Filtre statut — `"todo"` pour ne trier que des prospects encore à contacter.
   * SANS ce filtre, le tri part sur les plus récents tous statuts confondus et
   * brûle ses lots sur des comptes DÉJÀ démarchés (constaté le 31/07 : 136 des
   * 164 verdicts « qualified » portaient sur des `contacted`, sans effet sur la
   * sélection du jour).
   */
  status?: string;
  /** true (défaut) : ne qualifie que les profils encore sans verdict. */
  onlyUnqualified?: boolean;
  /** Nombre max de profils à traiter (défaut 200, cap QUALIFY_RUN_CAP). */
  limit?: number;
}

export interface QualifyRunResult {
  processed: number;
  selected: number;
  qualified: number;
  borderline: number;
  rejected: number;
  note?: string;
}

/**
 * Trie les profils par lots de 40 (méthode « filtrage ChatGPT » automatisée) :
 * envoie uniquement nom/pseudo/abonnés/bio à Claude, stocke verdict + profession
 * + raison, et recalcule le score d'opportunité (le verdict affine le tier).
 */
export async function qualifyRun(opts: QualifyRunOptions): Promise<QualifyRunResult> {
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), QUALIFY_RUN_CAP);
  const onlyUnqualified = opts.onlyUnqualified !== false;

  let q = supabase
    .from("instagram_prospects")
    .select("username, full_name, followers, bio, has_website, last_post_at, email, phone, is_business")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (onlyUnqualified) q = q.is("qualification", null);
  if (opts.status?.trim()) q = q.eq("status", opts.status.trim());
  if (opts.metier?.trim()) q = q.eq("metier", opts.metier.trim());
  if (opts.hashtag?.trim()) q = q.eq("hashtag_source", opts.hashtag.trim().replace(/^#/, ""));
  if (opts.scope?.hashtags.length) {
    q = q.or(`metier.eq.${opts.scope.metier},hashtag_source.in.(${opts.scope.hashtags.join(",")})`);
  }

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  if (!rows?.length) {
    return { processed: 0, selected: 0, qualified: 0, borderline: 0, rejected: 0, note: "Aucun profil à qualifier." };
  }

  const results = await qualifyProfiles(
    rows.map((r) => ({
      username: r.username as string,
      full_name: r.full_name as string | null,
      followers: r.followers as number | null,
      bio: r.bio as string | null,
    })),
    opts.avatar,
  );

  const byUsername = new Map(rows.map((r) => [r.username as string, r]));
  const counts = { qualified: 0, borderline: 0, rejected: 0 };
  for (const res of results) {
    counts[res.verdict]++;
    const row = byUsername.get(res.username);
    const base = row
      ? prospectScore({
          has_website: row.has_website as boolean | null,
          last_post_at: row.last_post_at as string | null,
          followers: row.followers as number | null,
          email: row.email as string | null,
          phone: row.phone as string | null,
          is_business: row.is_business as boolean | null,
          bio: row.bio as string | null,
        })
      : { score: 0, tier: "cold" as const };
    // Un rejeté est toujours cold ; un borderline plafonne à warm.
    const tier = res.verdict === "rejected" ? "cold" : res.verdict === "borderline" && base.tier === "hot" ? "warm" : base.tier;
    const { error: upErr } = await supabase
      .from("instagram_prospects")
      .update({
        qualification: res.verdict,
        qualification_reason: res.reason,
        profession_ia: res.profession,
        score: base.score,
        score_tier: tier,
      })
      .eq("username", res.username);
    if (upErr) console.error("[qualify] update failed:", res.username, upErr.message);
  }

  return {
    processed: results.length,
    selected: rows.length,
    ...counts,
    note: results.length < rows.length ? `${rows.length - results.length} profil(s) sans verdict exploitable (lot IA en échec) — relancer.` : undefined,
  };
}
