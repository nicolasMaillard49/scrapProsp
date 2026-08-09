import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { copierPhotoInstagram, avatarPath } from "@/app/lib/crmPhoto";

export const dynamic = "force-dynamic";

const BUCKET = "crm";

/**
 * GET /api/crm/[id]/photo — sert la photo copiée chez nous.
 *
 * Pourquoi une route et pas une URL de stockage : le bucket est privé, donc ses
 * liens sont SIGNÉS et expirent en une heure — une carte affichée le lendemain
 * montrerait une image morte. Cette route, elle, ne périme jamais, et reste
 * derrière l'authentification de l'app comme le reste.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseAdminConfigured) return NextResponse.json({ error: "stockage non configuré" }, { status: 503 });
  const { id } = await params;

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(avatarPath(id));
  if (error || !data) return NextResponse.json({ error: "pas de photo" }, { status: 404 });

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      // Une heure de cache navigateur : la photo d'un client ne bouge pas, et
      // `?v=` change quand on la rafraîchit.
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/**
 * POST /api/crm/[id]/photo — va rechercher la photo Instagram du prospect lié,
 * et la COPIE dans notre stockage.
 *
 * Les `profile_pic_url` d'Instagram sont des liens signés qui périment : celle
 * enregistrée au scrape répond 403 au bout de quelques semaines, et c'est
 * pourquoi les cartes finissent sans visage. Rafraîchir l'URL ne ferait que
 * repousser la panne — on télécharge donc l'image UNE fois et on la sert
 * nous-mêmes.
 *
 * Coût : une requête à la chaîne de sources IG (quota), d'où l'appel explicite
 * plutôt qu'un rafraîchissement en boucle.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  const { data: client } = await supabase
    .from("clients")
    .select("id, instagram_prospect_id")
    .eq("id", id)
    .single();
  if (!client) return NextResponse.json({ error: "dossier introuvable" }, { status: 404 });

  const pid = (client as { instagram_prospect_id: string | null }).instagram_prospect_id;
  if (!pid) return NextResponse.json({ error: "ce dossier ne vient pas d'Instagram" }, { status: 400 });

  const { data: prospect } = await supabase
    .from("instagram_prospects")
    .select("id, username, profile_pic_url")
    .eq("id", pid)
    .single();
  if (!prospect) return NextResponse.json({ error: "prospect introuvable" }, { status: 404 });

  const res = await copierPhotoInstagram(id, prospect as { id: string; username: string; profile_pic_url: string | null });
  if (!res.ok) return NextResponse.json({ error: res.raison ?? "photo indisponible" }, { status: 502 });

  return NextResponse.json({ ok: true, image_url: res.image_url, rafraichie: !!res.fraiche });
}
