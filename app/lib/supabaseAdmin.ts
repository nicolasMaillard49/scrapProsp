import { createClient } from "@supabase/supabase-js";

/**
 * Le client Supabase de SERVICE — clé secrète, jamais exposée au navigateur.
 *
 * Le client ordinaire (`supabase.ts`) porte la clé PUBLIABLE : elle part dans le
 * bundle, donc chez n'importe quel visiteur. Elle suffit pour les tables, dont
 * l'accès est déjà borné, mais le bucket `crm` est PRIVÉ — y écrire avec une clé
 * publique reviendrait à ouvrir les audits clients à qui lit le code source.
 *
 * À n'importer QUE depuis une route serveur (`app/api/**`). Un import depuis un
 * composant client ferait entrer la clé secrète dans le bundle.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";

export const supabaseAdmin = createClient(url || "https://placeholder.supabase.co", secret || "placeholder", {
  auth: { persistSession: false },
});

/** Faux tant que la clé secrète manque — les pièces jointes sont alors muettes, jamais en erreur. */
export const supabaseAdminConfigured = !!(url && secret);
