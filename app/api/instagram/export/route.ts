import { NextRequest } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { toCsv, type CsvColumn } from "@/app/lib/csv";

export const dynamic = "force-dynamic";

interface IgRow {
  username: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  followers: number | null;
  follows_count: number | null;
  posts_count: number | null;
  category: string | null;
  metier: string | null;
  ville: string | null;
  is_business: boolean | null;
  verified: boolean | null;
  has_website: boolean | null;
  external_url: string | null;
  profile_pic_url: string | null;
  bio: string | null;
  hashtag_source: string | null;
  status: string | null;
  score: number | null;
  score_tier: string | null;
  qualification: string | null;
  qualification_reason: string | null;
  profession_ia: string | null;
  last_post_at: string | null;
}

const yn = (b: boolean | null) => (b == null ? "" : b ? "oui" : "non");

const COLUMNS: CsvColumn<IgRow>[] = [
  { header: "score", value: (r) => r.score },
  { header: "priorite", value: (r) => r.score_tier },
  { header: "qualification_ia", value: (r) => r.qualification },
  { header: "profession_ia", value: (r) => r.profession_ia },
  { header: "raison_ia", value: (r) => r.qualification_reason },
  { header: "dernier_post", value: (r) => (r.last_post_at ? r.last_post_at.slice(0, 10) : "") },
  { header: "username", value: (r) => r.username },
  { header: "profil_url", value: (r) => `https://instagram.com/${r.username}` },
  { header: "nom", value: (r) => r.full_name },
  { header: "email", value: (r) => r.email },
  { header: "telephone", value: (r) => r.phone },
  { header: "abonnes", value: (r) => r.followers },
  { header: "abonnements", value: (r) => r.follows_count },
  { header: "publications", value: (r) => r.posts_count },
  { header: "categorie", value: (r) => r.category },
  { header: "metier", value: (r) => r.metier },
  { header: "ville", value: (r) => r.ville },
  { header: "compte_pro", value: (r) => yn(r.is_business) },
  { header: "verifie", value: (r) => yn(r.verified) },
  { header: "a_un_site", value: (r) => yn(r.has_website) },
  { header: "lien_externe", value: (r) => r.external_url },
  { header: "photo_profil", value: (r) => r.profile_pic_url },
  { header: "hashtag_source", value: (r) => r.hashtag_source },
  { header: "statut", value: (r) => r.status },
  { header: "bio", value: (r) => r.bio },
];

/**
 * GET /api/instagram/export?metier=&hasWebsite=&withEmail=&tier=&qualification=
 * Exporte les profils Instagram en CSV (Excel FR), triés par score décroissant.
 * Filtres optionnels : tier=hot|warm|cold, qualification=qualified|borderline|rejected.
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) return new Response("Supabase non configuré", { status: 503 });

  const sp = req.nextUrl.searchParams;
  let query = supabase
    .from("instagram_prospects")
    .select(
      "username, full_name, email, phone, followers, follows_count, posts_count, category, metier, ville, is_business, verified, has_website, external_url, profile_pic_url, bio, hashtag_source, status, score, score_tier, qualification, qualification_reason, profession_ia, last_post_at",
    )
    .order("score", { ascending: false, nullsFirst: false })
    .order("followers", { ascending: false, nullsFirst: false })
    .limit(5000);

  const metier = sp.get("metier");
  if (metier) query = query.eq("metier", metier);
  const hasWebsite = sp.get("hasWebsite");
  if (hasWebsite === "false") query = query.or("has_website.is.null,has_website.eq.false");
  if (hasWebsite === "true") query = query.eq("has_website", true);
  if (sp.get("withEmail") === "true") query = query.not("email", "is", null);
  const tier = sp.get("tier");
  if (tier && ["hot", "warm", "cold"].includes(tier)) query = query.eq("score_tier", tier);
  const qualification = sp.get("qualification");
  if (qualification && ["qualified", "borderline", "rejected"].includes(qualification)) {
    query = query.eq("qualification", qualification);
  }

  const { data, error } = await query;
  if (error) return new Response(`Erreur: ${error.message}`, { status: 502 });

  const csv = toCsv(COLUMNS, (data ?? []) as IgRow[]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="instagram-profils${metier ? `-${metier}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
