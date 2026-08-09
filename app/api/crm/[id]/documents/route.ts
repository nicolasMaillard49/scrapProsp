import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { cleanText, parseDocKind, DOCUMENT_COLS, type ClientDocument } from "@/app/lib/crm";

export const dynamic = "force-dynamic";

/** 25 Mo — la limite du bucket. Un audit PDF fait 2 à 5 Mo, on est large. */
const TAILLE_MAX = 25 * 1024 * 1024;

const BUCKET = "crm";

/**
 * Les pièces d'un dossier, avec un lien de lecture SIGNÉ.
 *
 * Le bucket est privé : un audit nomme des chiffres d'affaires, des faiblesses
 * de site et des budgets. Le lien est donc fabriqué à la demande et expire —
 * une URL publique devinable suffirait à exposer le rapport d'un client.
 */
async function readDocuments(clientId: string) {
  const { data, error } = await supabase
    .from("client_documents")
    .select(DOCUMENT_COLS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const docs = (data ?? []) as ClientDocument[];
  return Promise.all(
    docs.map(async (d) => {
      const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(d.path, 3600);
      return { ...d, url: signed?.signedUrl ?? null };
    }),
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, documents: await readDocuments(id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * POST /api/crm/[id]/documents — dépose un fichier (multipart).
 *
 * Le fichier va dans Storage, la base ne garde que le CHEMIN, le nom d'origine
 * et la taille : mettre des octets dans Postgres alourdirait chaque lecture du
 * dossier pour un contenu qu'on n'ouvre presque jamais.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "SUPABASE_SECRET_KEY manquante — le dépôt de fichiers est désactivé" }, { status: 503 });
  }
  const { id } = await params;

  const { data: client } = await supabase.from("clients").select("id").eq("id", id).single();
  if (!client) return NextResponse.json({ error: "dossier introuvable" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "envoi illisible" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "fichier requis" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "fichier vide" }, { status: 400 });
  if (file.size > TAILLE_MAX) {
    return NextResponse.json({ error: `fichier trop lourd (${Math.round(file.size / 1e6)} Mo, maximum 25 Mo)` }, { status: 413 });
  }

  const kind = parseDocKind(form.get("kind"));
  const nom = cleanText(file.name) ?? "document";
  // Le nom d'origine est CONSERVÉ en base mais jamais utilisé comme chemin :
  // accents, espaces et homonymes s'y écraseraient les uns les autres.
  const ext = /\.([a-z0-9]{1,8})$/i.exec(nom)?.[1]?.toLowerCase() ?? "bin";
  const path = `${id}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return NextResponse.json({ error: `envoi refusé : ${upErr.message}` }, { status: 500 });

  const { error } = await supabase.from("client_documents").insert({
    client_id: id,
    path,
    nom,
    mime: file.type || null,
    taille: file.size,
    kind,
  });
  if (error) {
    // La ligne n'a pas été écrite : le fichier orphelin ne doit pas rester à
    // consommer du stockage pour rien.
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, documents: await readDocuments(id) });
}

/** DELETE /api/crm/[id]/documents?doc=<uuid> — retire la ligne ET le fichier. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  const docId = req.nextUrl.searchParams.get("doc");
  if (!docId) return NextResponse.json({ error: "paramètre doc requis" }, { status: 400 });

  const { data: doc } = await supabase
    .from("client_documents")
    .select("id, path")
    .eq("id", docId)
    .eq("client_id", id)
    .single();
  if (!doc) return NextResponse.json({ error: "document introuvable" }, { status: 404 });

  const { error } = await supabase.from("client_documents").delete().eq("id", docId).eq("client_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Le fichier part APRÈS la ligne : un fichier supprimé sans sa ligne
  // laisserait une pièce fantôme dans le dossier, avec un lien mort.
  await supabaseAdmin.storage.from(BUCKET).remove([(doc as { path: string }).path]);

  return NextResponse.json({ ok: true, documents: await readDocuments(id) });
}
