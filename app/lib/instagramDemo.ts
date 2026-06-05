import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import type { TemplateProps } from "@/app/maquette/templates/data";

/** Colonnes nécessaires au rendu d'un aperçu Instagram. */
const SELECT = "username, full_name, metier, ville";

interface IgRow {
  username: string;
  full_name: string | null;
  metier: string | null;
  ville: string | null;
}

/** Mappe une ligne instagram_prospects vers les props attendues par les templates. */
function toTemplateProps(row: IgRow): TemplateProps {
  return {
    name: (row.full_name && row.full_name.trim()) || `@${row.username}`,
    metier: row.metier ?? "",
    ville: row.ville ?? "",
    phone: "",
    rating: null,
    reviews: null,
    address: null,
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
