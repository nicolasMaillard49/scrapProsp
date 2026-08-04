// app/lib/igMaps.ts
// La fiche Google Maps d'un prospect Instagram — lecture, écriture, et la
// phrase qu'on en tire.
//
// Tolérant à l'ABSENCE des colonnes (migration 024 pas encore jouée) : chaque
// accès retombe silencieusement sur « pas de données ». Sans ça, déployer le
// code avant la migration ferait tomber la trame entière — c'est-à-dire tout
// l'outil — pour une fonctionnalité d'agrément.

import { supabase } from "./supabase";
import type { IgCompetitorReport } from "./igCompetitor";

export interface MapsFacts {
  rank: number | null;
  rating: number | null;
  reviews: number | null;
  phone: string | null;
  address: string | null;
  adsCount: number | null;
  total: number | null;
  /** Toujours présent : `toFacts` renvoie null quand le prospect n'a jamais été scrapé. */
  checkedAt: string;
}

export const MAPS_COLUMNS =
  "maps_rank, maps_rating, maps_reviews, maps_phone, maps_address, maps_ads_count, maps_total, maps_checked_at";

interface MapsRow {
  maps_rank: number | null;
  maps_rating: number | null;
  maps_reviews: number | null;
  maps_phone: string | null;
  maps_address: string | null;
  maps_ads_count: number | null;
  maps_total: number | null;
  maps_checked_at: string | null;
}

export function toFacts(row: Partial<MapsRow> | null | undefined): MapsFacts | null {
  if (!row || row.maps_checked_at == null) return null;
  return {
    rank: row.maps_rank ?? null,
    rating: row.maps_rating == null ? null : Number(row.maps_rating),
    reviews: row.maps_reviews ?? null,
    phone: (row.maps_phone ?? "").trim() || null,
    address: (row.maps_address ?? "").trim() || null,
    adsCount: row.maps_ads_count ?? null,
    total: row.maps_total ?? null,
    checkedAt: row.maps_checked_at,
  };
}

/** Fiche Maps d'un prospect. `null` si jamais scrapé — ou si la migration 024 n'est pas jouée. */
export async function getMapsFacts(prospectId: string): Promise<MapsFacts | null> {
  const { data, error } = await supabase
    .from("instagram_prospects")
    .select(MAPS_COLUMNS)
    .eq("id", prospectId)
    .maybeSingle();
  if (error) return null; // colonne absente = migration pas jouée : on continue sans
  return toFacts(data as Partial<MapsRow> | null);
}

/**
 * Enregistre ce que le rapport concurrentiel vient d'apprendre.
 *
 * Appelé APRÈS coup, jamais dans le chemin critique : un échec d'écriture ne
 * doit pas transformer un rapport réussi en erreur 500 à l'écran.
 */
export async function saveMapsFacts(prospectId: string, report: IgCompetitorReport): Promise<boolean> {
  const { error } = await supabase
    .from("instagram_prospects")
    .update({
      maps_rank: report.selfRank,
      maps_rating: report.self?.rating ?? null,
      maps_reviews: report.self?.reviews ?? null,
      maps_phone: report.self?.phone ?? null,
      maps_address: report.self?.address ?? null,
      maps_ads_count: report.adsCount,
      maps_total: report.total,
      maps_checked_at: new Date().toISOString(),
    })
    .eq("id", prospectId);
  return !error;
}

/**
 * Le fait qu'il ignore, en une phrase — celle qu'on peut coller telle quelle.
 *
 * Volontairement FACTUELLE et sans pitch : c'est une observation, pas une
 * offre. « Vous n'apparaissez pas » est plus fort que n'importe quel argument
 * de vente, à condition de ne rien vendre dans la même phrase.
 */
export function mapsHeadline(f: MapsFacts, metier: string, ville: string): string {
  const requete = [metier, ville].filter(Boolean).join(" ");
  const place =
    f.rank === null
      ? `vous n'apparaissez pas dans les résultats`
      : `vous êtes ${f.rank}${f.rank === 1 ? "er" : "e"}${f.total ? ` sur ${f.total}` : ""}`;
  const ads =
    f.adsCount && f.adsCount > 0
      ? `${f.adsCount} concurrent${f.adsCount > 1 ? "s paient" : " paie"} des Google Ads dessus`
      : `personne ne paie pour ces recherches`;
  return requete ? `« ${requete} » : ${place}, et ${ads}.` : `${place}, et ${ads}.`;
}
