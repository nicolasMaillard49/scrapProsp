// Contrat commun aux sources de données Instagram (Apify, RapidAPI…).
//
// Le shape `IgProfile` est celui de l'actor Apify `instagram-profile-scraper` :
// c'est lui que consomment `instagram.ts` (isProspect / pickContact /
// extractLastPostAt) et `igDiscover.ts`. Tout nouveau provider doit donc
// *traduire* sa réponse vers ce shape — jamais l'inverse. Les alias de contact
// et `latestPosts[].timestamp` (ISO) font partie du contrat : les perdre casse
// silencieusement le score et le double check d'activité.

export interface IgProfile {
  username: string;
  fullName?: string | null;
  biography?: string | null;
  externalUrl?: string | null;
  externalUrls?: Array<{ url?: string }> | string[] | null;
  followersCount?: number | null;
  followsCount?: number | null;
  postsCount?: number | null;
  businessCategoryName?: string | null;
  isBusinessAccount?: boolean | null;
  verified?: boolean | null;
  private?: boolean;
  profilePicUrl?: string | null;
  // Contact public exposé par les comptes pro/business — noms de champs variables
  // selon la version de l'actor : on couvre les alias connus.
  public_email?: string | null;
  businessEmail?: string | null;
  public_phone_number?: string | null;
  businessPhoneNumber?: string | null;
  contactPhoneNumber?: string | null;
  // Tout le reste du profil renvoyé par la source (conservé en `raw`).
  [key: string]: unknown;
}

/**
 * Nature d'une panne, qui décide de la suite :
 *  - quota      : crédits du mois épuisés → on passe au provider suivant, cooldown long
 *  - auth       : clé absente/invalide/non abonnée → cooldown très long (config à corriger)
 *  - rate_limit : trop d'appels par seconde/minute → un retry court, puis suivant
 *  - transient  : 5xx, timeout, réseau → un retry, puis suivant
 *  - fatal      : réponse inexploitable → suivant, sans retry
 */
export type FailureKind = "quota" | "auth" | "rate_limit" | "transient" | "fatal";

export class ProviderError extends Error {
  readonly provider: string;
  readonly kind: FailureKind;
  readonly status?: number;

  constructor(provider: string, kind: FailureKind, message: string, status?: number) {
    super(`[${provider}/${kind}] ${message}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
    this.status = status;
  }
}

/** Un candidat sorti d'un feed hashtag : username connu, ou seulement l'id Instagram. */
export interface HashtagCandidate {
  /** id numérique Instagram du compte (toujours présent chez les providers RapidAPI). */
  igUserId?: string | null;
  /** username, quand la source le donne directement (Apify) ou après résolution. */
  username?: string | null;
}

export interface IgProvider {
  /** Identifiant stable, utilisé dans les logs, l'ordre de priorité et l'état persisté. */
  readonly name: string;
  /** false = credentials absents → le provider est ignoré sans être marqué en panne. */
  readonly configured: boolean;
  /**
   * Comptes ayant posté sous un hashtag. `limit` = nombre de posts à scanner.
   * Absent = le provider ne sait pas découvrir (profils uniquement).
   */
  hashtagCandidates?(hashtag: string, limit: number): Promise<HashtagCandidate[]>;
  /** Profils détaillés depuis des usernames. */
  profilesByUsername(usernames: string[]): Promise<IgProfile[]>;
  /**
   * Profils détaillés depuis des ids Instagram. Absent = le provider ne sait pas
   * résoudre un id, ses candidats hashtag devront l'être par un autre provider.
   */
  profilesById?(igUserIds: string[]): Promise<IgProfile[]>;
}
