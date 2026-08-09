import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { cleanText, parseNoteKind, NOTE_COLS } from "@/app/lib/crm";

export const dynamic = "force-dynamic";

async function readNotes(clientId: string) {
  const { data, error } = await supabase
    .from("client_notes")
    .select(NOTE_COLS)
    .eq("client_id", clientId)
    .order("at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * POST /api/crm/[id]/notes  { body, kind?, at? } — empile une entrée de journal.
 *
 * `at` est la date de L'ÉVÉNEMENT, pas celle de la saisie : un appel du mardi
 * noté le jeudi appartient au mardi. Sans ce champ, la chronologie d'un dossier
 * raconterait quand on a pris le temps d'écrire, ce qui n'intéresse personne.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: { body?: string; kind?: string; at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const texte = cleanText(body.body);
  if (!texte) return NextResponse.json({ error: "contenu requis" }, { status: 400 });

  const kind = parseNoteKind(body.kind);
  if (!kind) return NextResponse.json({ error: `genre invalide (${body.kind})` }, { status: 400 });

  // Une date fournie doit être une VRAIE date : `new Date("bientôt")` rend
  // `Invalid Date`, que Postgres refuse avec un message incompréhensible.
  let at: string | undefined;
  if (body.at) {
    const d = new Date(body.at);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "date invalide" }, { status: 400 });
    at = d.toISOString();
  }

  const { error } = await supabase
    .from("client_notes")
    .insert({ client_id: id, body: texte, kind, ...(at ? { at } : {}) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, notes: await readNotes(id) });
}

/** DELETE /api/crm/[id]/notes?note=<uuid> — retire une entrée mal saisie. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  const noteId = req.nextUrl.searchParams.get("note");
  if (!noteId) return NextResponse.json({ error: "paramètre note requis" }, { status: 400 });

  const { error } = await supabase.from("client_notes").delete().eq("id", noteId).eq("client_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notes: await readNotes(id) });
}
