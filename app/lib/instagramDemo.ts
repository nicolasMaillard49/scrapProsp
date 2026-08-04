import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import type { TemplateProps } from "@/app/maquette/templates/data";

/** Colonnes nécessaires au rendu d'un aperçu Instagram. */
const SELECT = "username, full_name, metier, ville, phone";

interface IgRow {
  username: string;
  full_name: string | null;
  metier: string | null;
  ville: string | null;
  phone: string | null;
}

/* ────────────────────────────────────────────────────────────
 * Remplissage d'une maquette dont on n'a pas la donnée réelle.
 *
 * Un prospect Instagram n'apporte que quatre champs : nom, métier, ville et
 * parfois un téléphone. Les templates, eux, sont dessinés pour une fiche
 * Google complète — laissés vides, ils sortent un bouton d'appel BLANC en
 * haut de page et un bloc d'avis creux. Un aperçu envoyé en DM se juge en
 * trois secondes : vide, il ne projette rien du tout.
 *
 * On remplit donc en factice, comme le font déjà les kits de niche pour les
 * témoignages (`nicheKits.testimonials`). Deux garde-fous, parce qu'il s'agit
 * du nom d'un vrai commerce :
 *  - les pages /di sont en `noindex, nofollow` (cf. demoMetadata) : elles ne
 *    peuvent pas devenir la preuve sociale d'un tiers dans un moteur ;
 *  - le téléphone est tiré de la plage RÉSERVÉE À LA FICTION par l'ARCEP
 *    (06 39 98 XX XX) : il a l'air vrai, il projette, et il ne peut faire
 *    sonner personne.
 *
 * Les valeurs sont dérivées du pseudo : deux maquettes différentes n'affichent
 * pas la même note, et la même maquette ne change pas d'un rechargement à
 * l'autre (elle peut être rouverte pendant l'appel).
 * ──────────────────────────────────────────────────────────── */

/** Empreinte stable d'une chaîne — même pseudo, mêmes chiffres, toujours. */
function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function placeholders(username: string): { phone: string; rating: number; reviews: number } {
  const seed = seedOf(username);
  return {
    // 06 39 98 XX XX — plage de fiction ARCEP, jamais attribuée à un abonné.
    phone: `06 39 98 ${String(10 + (seed % 90))} ${String(10 + ((seed >> 7) % 90))}`,
    // 4.6 à 4.9 : au-dessus, une note ronde de 5.0 sonne faux et décrédibilise
    // la maquette entière.
    rating: 4.6 + ((seed >> 3) % 4) / 10,
    reviews: 40 + ((seed >> 11) % 130),
  };
}

/** Mappe une ligne instagram_prospects vers les props attendues par les templates. */
function toTemplateProps(row: IgRow): TemplateProps {
  const faux = placeholders(row.username);
  return {
    name: (row.full_name && row.full_name.trim()) || `@${row.username}`,
    metier: row.metier ?? "",
    ville: row.ville ?? "",
    phone: (row.phone ?? "").trim() || faux.phone,
    rating: faux.rating,
    reviews: faux.reviews,
    // Volontairement pas de rue inventée : une adresse précise et fausse sur
    // le nom d'un vrai commerce peut envoyer quelqu'un sonner à la mauvaise
    // porte. « Centre-ville » remplit la mise en page sans rien affirmer.
    address: row.ville ? `Centre-ville, ${row.ville}` : "Centre-ville",
  };
}

/**
 * Récupère un prospect Instagram par préfixe d'UUID (route courte /di/[code]).
 * Même technique de bornage uuid que getProspectByCode (cf. lib/demo).
 */
export async function getInstagramProspectByCode(code: string): Promise<TemplateProps | null> {
  if (!supabaseConfigured) return null;
  const c = code.toLowerCase();
  if (!/^[0-9a-f]{1,8}$/.test(c)) return null;
  const lo = `${c.padEnd(8, "0")}-0000-0000-0000-000000000000`;
  const next = Number.parseInt(c.padEnd(8, "0"), 16) + 1;
  const hiPrefix = next > 0xffffffff ? null : next.toString(16).padStart(8, "0");
  let query = supabase.from("instagram_prospects").select(SELECT).gte("id", lo);
  if (hiPrefix) query = query.lt("id", `${hiPrefix}-0000-0000-0000-000000000000`);
  const { data } = await query.limit(1);
  const row = data?.[0] as IgRow | undefined;
  return row ? toTemplateProps(row) : null;
}
