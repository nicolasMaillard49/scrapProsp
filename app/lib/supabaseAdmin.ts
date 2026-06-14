import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur avec la clé secrète (service_role).
 * À n'utiliser QUE dans des routes API / server actions (jamais côté client) :
 * il bypass la RLS, donc il sert aux écritures du funnel d'éligibilité.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";

export const supabaseAdminConfigured = !!(url && secret);

export const supabaseAdmin = createClient(
  url || "https://placeholder.supabase.co",
  secret || "placeholder",
  { auth: { persistSession: false } }
);
