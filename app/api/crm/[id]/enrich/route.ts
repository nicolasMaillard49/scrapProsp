import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { cleanText, normalizeUrl, memeValeur, CLIENT_COLS } from "@/app/lib/crm";
import { fetchProfiles, igSourceConfigured } from "@/app/lib/igSource";
import { SCRAPER_URL } from "@/app/lib/competitor-config";
import { copierPhotoInstagram } from "@/app/lib/crmPhoto";

export const dynamic = "force-dynamic";
// Le scrape Maps ouvre un navigateur sur le VPS : c'est lent, jamais instantané.
export const maxDuration = 300;

/**
 * POST /api/crm/[id]/enrich — va chercher les infos du client à la source.
 *
 * Deux sources, selon ce qu'on sait déjà de lui :
 *  - `instagram` : le profil du prospect lié (nom d'usage, bio, site, contact
 *    pro, photo) — une requête de quota sur la chaîne de sources ;
 *  - `google` : sa fiche Google Business, via le scraper du VPS, retrouvée par
 *    métier + ville puis rapprochée par NOM (le scraper cherche une catégorie
 *    dans une commune, il ne sait pas viser une entreprise précise).
 *
 * RÈGLE ABSOLUE : on ne remplit que les champs VIDES. Ce que Nicolas a saisi à
 * la main l'emporte toujours sur ce qu'une source raconte — un numéro corrigé
 * après un appel vaut mieux que celui qui traîne sur une fiche jamais mise à
 * jour. Ce qui a été ignoré est renvoyé, pour qu'il puisse trancher lui-même.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: { source?: "instagram" | "google" };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { data: client } = await supabase.from("clients").select(CLIENT_COLS).eq("id", id).single();
  if (!client) return NextResponse.json({ error: "dossier introuvable" }, { status: 404 });
  const c = client as Record<string, unknown>;

  const source = body.source ?? (c.instagram_prospect_id ? "instagram" : "google");

  const trouve = source === "instagram" ? await depuisInstagram(c) : await depuisGoogle(c);
  if ("erreur" in trouve) return NextResponse.json({ error: trouve.erreur }, { status: 502 });

  // Seuls les champs vides sont remplis.
  const patch: Record<string, unknown> = {};
  const ignores: string[] = [];
  for (const [champ, valeur] of Object.entries(trouve.champs)) {
    if (valeur === null || valeur === undefined || valeur === "") continue;
    const actuel = c[champ];
    if (actuel === null || actuel === undefined || actuel === "") patch[champ] = valeur;
    // `+33 6…` et `06…` sont le même numéro : ne signaler que les VRAIES
    // différences, sinon l'alerte devient du bruit qu'on apprend à ignorer.
    else if (!memeValeur(champ, actuel, valeur)) ignores.push(champ);
  }

  let maj = client;
  if (Object.keys(patch).length) {
    const { data, error } = await supabase.from("clients").update(patch).eq("id", id).select(CLIENT_COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    maj = data;
  }

  return NextResponse.json({
    ok: true,
    source,
    client: maj,
    remplis: Object.keys(patch),
    /** Champs où la source dit autre chose que la saisie — à trancher à la main. */
    ignores,
    trouve: trouve.champs,
    resume: trouve.resume ?? null,
  });
}

type Trouvaille = { champs: Record<string, string | null>; resume?: string } | { erreur: string };

/** Le profil Instagram du prospect lié — nom d'usage, bio, site, contact pro. */
async function depuisInstagram(c: Record<string, unknown>): Promise<Trouvaille> {
  const pid = c.instagram_prospect_id as string | null;
  if (!pid) return { erreur: "ce dossier n'est pas lié à un prospect Instagram" };
  if (!igSourceConfigured) return { erreur: "aucune source Instagram configurée" };

  const { data: p } = await supabase
    .from("instagram_prospects")
    .select("id, username, profile_pic_url")
    .eq("id", pid)
    .single();
  if (!p) return { erreur: "prospect introuvable" };

  const prospect = p as { id: string; username: string; profile_pic_url: string | null };
  let profil;
  try {
    [profil] = await fetchProfiles([prospect.username]);
  } catch (e) {
    return { erreur: `source Instagram indisponible : ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!profil) return { erreur: `profil @${prospect.username} introuvable` };

  // La photo suit le même chemin que partout : téléchargée chez nous, jamais
  // un lien signé qui périmera.
  void copierPhotoInstagram(c.id as string, prospect).catch(() => undefined);

  const tel = (profil.public_phone_number ?? profil.businessPhoneNumber ?? profil.contactPhoneNumber) as string | null;
  const mail = (profil.public_email ?? profil.businessEmail) as string | null;

  return {
    champs: {
      contact: cleanText(profil.fullName),
      telephone: cleanText(tel),
      email: cleanText(mail),
      site_url: normalizeUrl(profil.externalUrl),
      description: cleanText(profil.biography),
    },
    resume: `@${prospect.username} · ${profil.followersCount ?? "?"} abonnés`,
  };
}

/**
 * La fiche Google Business, via le scraper du VPS.
 *
 * Le scraper cherche une CATÉGORIE dans une COMMUNE : il ne sait pas viser une
 * entreprise. On lui demande donc le métier de la ville, puis on rapproche par
 * nom — et si aucun résultat ne ressemble au client, on ne devine pas : mieux
 * vaut ne rien remplir que remplir avec le concurrent d'à côté.
 */
async function depuisGoogle(c: Record<string, unknown>): Promise<Trouvaille> {
  const ville = cleanText(c.ville);
  const metier = cleanText(c.metier);
  if (!ville || !metier) return { erreur: "métier et ville sont nécessaires pour chercher la fiche Google" };

  let liste: GbpRow[];
  try {
    const res = await fetch(`${SCRAPER_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ville, metier, limit: 20, quick: false }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!res.ok) return { erreur: `scraper VPS en erreur (${res.status})` };
    const json = (await res.json()) as { competitors?: GbpRow[]; detail?: string };
    if (json.detail) return { erreur: `scraper VPS : ${json.detail}` };
    liste = json.competitors ?? [];
  } catch (e) {
    return { erreur: `scraper VPS injoignable : ${e instanceof Error ? e.message : String(e)}` };
  }

  const fiche = rapprocher(String(c.nom ?? ""), liste);
  if (!fiche) return { erreur: `aucune fiche Google ne correspond à « ${c.nom} » parmi ${liste.length} résultats` };

  const note = fiche.rating ? `${fiche.rating}★` : null;
  const avis = fiche.reviews ? `${fiche.reviews} avis` : null;

  return {
    champs: {
      telephone: cleanText(fiche.phone),
      site_url: normalizeUrl(fiche.website),
    },
    resume: [fiche.name, [note, avis].filter(Boolean).join(" · "), cleanText(fiche.address)]
      .filter(Boolean)
      .join(" — "),
  };
}

interface GbpRow {
  name: string;
  rating?: string;
  reviews?: string;
  phone?: string;
  address?: string;
  website?: string;
  maps_url?: string;
  category?: string;
}

/** Rapprochement par nom normalisé — exact, puis inclusion. Jamais approximatif. */
function rapprocher(nom: string, liste: GbpRow[]): GbpRow | null {
  const norme = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const cible = norme(nom);
  if (!cible) return null;
  return (
    liste.find((r) => norme(r.name) === cible) ??
    liste.find((r) => norme(r.name).includes(cible) || cible.includes(norme(r.name))) ??
    null
  );
}
