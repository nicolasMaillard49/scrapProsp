import { supabase } from "./supabase";
import { supabaseAdmin, supabaseAdminConfigured } from "./supabaseAdmin";
import { fetchProfiles, igSourceConfigured } from "./igSource";

/**
 * La photo d'un client venu d'Instagram, COPIÉE chez nous.
 *
 * Les `profile_pic_url` d'Instagram sont des liens SIGNÉS : ils répondent 403
 * au bout de quelques semaines, et c'est pour ça que les cartes finissent sans
 * visage. Rafraîchir l'URL ne ferait que repousser la panne — on télécharge
 * l'image une fois, et on la sert nous-mêmes depuis `/api/crm/<id>/photo`.
 *
 * Deux chemins, du moins cher au plus cher :
 *  1. l'URL déjà en base — gratuite tant qu'elle vit ;
 *  2. une redemande du profil à la chaîne de sources — UNE requête de quota,
 *     réservée au cas où la première a expiré.
 *
 * À N'IMPORTER QUE depuis une route serveur : `supabaseAdmin` porte la clé secrète.
 */

const BUCKET = "crm";

export const avatarPath = (clientId: string) => `${clientId}/avatar.jpg`;

export interface PhotoResult {
  ok: boolean;
  image_url?: string;
  /** L'URL fraîche obtenue de la source, à reposer côté prospection. */
  fraiche?: string | null;
  raison?: string;
}

export async function copierPhotoInstagram(
  clientId: string,
  prospect: { id: string; username: string; profile_pic_url?: string | null },
  { autoriserSource = true }: { autoriserSource?: boolean } = {},
): Promise<PhotoResult> {
  if (!supabaseAdminConfigured) return { ok: false, raison: "stockage non configuré" };

  let bytes = await telecharger(prospect.profile_pic_url);
  let fraiche: string | null = null;

  if (!bytes && autoriserSource && igSourceConfigured) {
    try {
      const [profil] = await fetchProfiles([prospect.username]);
      fraiche = (profil?.profilePicUrl as string | undefined) ?? null;
      bytes = await telecharger(fraiche);
    } catch (e) {
      return { ok: false, raison: `source Instagram indisponible : ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  if (!bytes) return { ok: false, raison: "photo introuvable (lien Instagram périmé)" };

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(avatarPath(clientId), bytes, { contentType: "image/jpeg", upsert: true });
  if (upErr) return { ok: false, raison: `stockage refusé : ${upErr.message}` };

  // L'écran pointe sur NOTRE route, qui ne périme pas ; `?v=` casse le cache
  // navigateur quand la photo est rafraîchie.
  const image_url = `/api/crm/${clientId}/photo?v=${Date.now()}`;
  await supabase.from("clients").update({ image_url }).eq("id", clientId);
  if (fraiche) await supabase.from("instagram_prospects").update({ profile_pic_url: fraiche }).eq("id", prospect.id);

  return { ok: true, image_url, fraiche };
}

/** Télécharge une image, ou `null` — un 403 de CDN n'est pas une panne ici. */
async function telecharger(url: string | null | undefined): Promise<ArrayBuffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}
