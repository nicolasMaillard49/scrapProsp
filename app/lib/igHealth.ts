// Auto-test de la chaîne de refill Instagram — le « canari ».
//
// Pourquoi ce fichier existe : deux fois de suite, la prospection s'est arrêtée
// sans que personne ne le sache avant le lendemain matin, sélection vide.
//  - 01/08 : plancher de quota calibré pour un plan Pro, appliqué à un plan
//    gratuit → la boucle s'auto-désactivait à la passe 0 ;
//  - 02/08 : l'alias court « claude-haiku-4-5 » renvoyait 404 → chaque lot de
//    qualification échouait EN SILENCE (`qualifyProfiles` avale l'erreur lot par
//    lot), 0 verdict, 12 passes et 831 s brûlées pour rien.
//
// Le point commun n'est pas la panne : c'est qu'aucune de ces pannes ne se
// voyait. Le système ne savait pas dire s'il allait bien — il le découvrait en
// échouant, six heures trop tard. Ce module lui donne la réponse AVANT qu'on en
// dépende, en payant le seul prix qui rend le test honnête : un vrai appel au
// modèle, sur un lot synthétique, dont on vérifie que le verdict revient
// parsable. Un `if (process.env.ANTHROPIC_API_KEY)` n'aurait attrapé ni l'un ni
// l'autre des deux incidents.

import { supabase, supabaseConfigured } from "./supabase";
import { qualifyAvailable, qualifyProfiles, modeleQualification, repliModeleActif } from "./igQualify";
import { leadsStatus } from "./igLeads";

export interface HealthCheck {
  /** Identifiant court du poste vérifié (`ia`, `base`, `quota`…). */
  poste: string;
  ok: boolean;
  /** Ce qu'on a constaté, en clair — destiné à être lu dans Telegram. */
  detail: string;
  /** Un souci qui n'empêche pas de tourner (quota bas, repli de modèle…). */
  alerte?: boolean;
}

export interface HealthReport {
  ok: boolean;
  /** true si tout tourne mais qu'un poste mérite un coup d'œil. */
  alerte: boolean;
  checks: HealthCheck[];
  /** Résumé d'une ligne, prêt à poster. */
  resume: string;
}

/**
 * Trois profils bidon : un qui doit passer, un hors avatar, un vide. On ne juge
 * PAS la pertinence des verdicts (le modèle a le droit d'hésiter) — on vérifie
 * seulement que l'aller-retour marche et que la réponse est exploitable. C'est
 * exactement ce que le 404 du 02/08 cassait.
 */
const LOT_TEMOIN = [
  { username: "canari_menuisier_test", full_name: "Atelier Bois du Test", followers: 800, bio: "Menuisier à Bordeaux — agencement sur mesure. Devis gratuit." },
  { username: "canari_horscible_test", full_name: "Global Supplies Ltd", followers: 120000, bio: "Worldwide wholesale supplier. DM for catalog." },
  { username: "canari_vide_test", full_name: null, followers: null, bio: null },
];

/** Le poste IA : un VRAI appel, seul moyen d'attraper un modèle inconnu. */
async function verifierIA(): Promise<HealthCheck> {
  if (!qualifyAvailable()) {
    return { poste: "ia", ok: false, detail: "ANTHROPIC_API_KEY absente — aucune qualification possible." };
  }
  const erreurs: string[] = [];
  try {
    const res = await qualifyProfiles(
      LOT_TEMOIN,
      { profession: "artisan du bâtiment (menuisier, plombier, électricien)", minFollowers: 0, maxFollowers: 2500 },
      undefined,
      (m) => erreurs.push(m),
    );
    if (!res.length) {
      return {
        poste: "ia",
        ok: false,
        detail: `le modèle ${modeleQualification()} n'a rendu AUCUN verdict exploitable${erreurs.length ? ` — ${erreurs[0].slice(0, 200)}` : ""}`,
      };
    }
    // Un repli a eu lieu : ça tourne, mais la variable d'env est fausse.
    const repli = repliModeleActif();
    if (repli) return { poste: "ia", ok: true, alerte: true, detail: repli };
    return { poste: "ia", ok: true, detail: `${res.length}/${LOT_TEMOIN.length} verdicts rendus par ${modeleQualification()}` };
  } catch (e) {
    return { poste: "ia", ok: false, detail: e instanceof Error ? e.message.slice(0, 240) : String(e) };
  }
}

/** Le poste base : la sélection du jour est illisible si Supabase ne répond pas. */
async function verifierBase(): Promise<HealthCheck> {
  if (!supabaseConfigured) return { poste: "base", ok: false, detail: "Supabase non configuré (URL / clé absente)." };
  try {
    const { error } = await supabase.from("instagram_prospects").select("id", { count: "exact", head: true }).limit(1);
    if (error) return { poste: "base", ok: false, detail: error.message.slice(0, 200) };
    return { poste: "base", ok: true, detail: "Supabase répond." };
  } catch (e) {
    return { poste: "base", ok: false, detail: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
}

/**
 * Le poste quota : informatif, JAMAIS bloquant. Un quota bas est une raison de
 * prévenir, pas d'arrêter — c'est précisément l'erreur du plancher figé à 1500
 * qui a auto-désactivé la boucle le 01/08.
 */
async function verifierQuota(): Promise<HealthCheck> {
  try {
    const { quota, pending } = await leadsStatus();
    if (!quota) return { poste: "quota", ok: true, detail: `aucun quota connu pour l'instant, ${pending} piste(s) en file` };
    const part = quota.limit ? Math.round((quota.remaining / quota.limit) * 100) : 0;
    return {
      poste: "quota",
      ok: true,
      alerte: part < 10,
      detail: `${quota.provider} : ${quota.remaining}/${quota.limit} (${part} %), ${pending} piste(s) en file`,
    };
  } catch (e) {
    return { poste: "quota", ok: true, alerte: true, detail: `quota illisible — ${e instanceof Error ? e.message.slice(0, 160) : String(e)}` };
  }
}

/**
 * Passe tous les postes. Les vérifications sont indépendantes → en parallèle,
 * pour que le canari reste court même quand un poste traîne.
 */
export async function igHealth(): Promise<HealthReport> {
  const checks = await Promise.all([verifierBase(), verifierIA(), verifierQuota()]);
  const ok = checks.every((c) => c.ok);
  const alerte = checks.some((c) => c.alerte);
  const casses = checks.filter((c) => !c.ok).map((c) => c.poste);
  const resume = ok
    ? alerte
      ? `chaîne OK, ${checks.filter((c) => c.alerte).map((c) => c.poste).join(" + ")} à surveiller`
      : "chaîne OK"
    : `chaîne CASSÉE : ${casses.join(" + ")}`;
  return { ok, alerte, checks, resume };
}
