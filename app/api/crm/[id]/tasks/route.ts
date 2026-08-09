import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { cleanText, nextRank, parseChecklistPaste, TASK_COLS } from "@/app/lib/crm";
import { templateById } from "@/app/lib/crmTemplates";

export const dynamic = "force-dynamic";

/** Les étapes du dossier, dans l'ordre — relues après chaque écriture. */
async function readTasks(clientId: string) {
  const { data, error } = await supabase
    .from("client_tasks")
    .select(TASK_COLS)
    .eq("client_id", clientId)
    .order("rank", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as { rank: number }[];
}

interface PostBody {
  /** Une étape unique. */
  label?: string;
  phase?: string;
  details?: string;
  due_date?: string;
  /** Un COLLAGE multi-lignes : une étape par ligne (cf. `parseChecklistPaste`). */
  paste?: string;
  /** Un modèle de mission à dérouler d'un coup. */
  template?: string;
}

/**
 * POST /api/crm/[id]/tasks — ajoute des étapes. Trois entrées, un seul chemin :
 *
 *  - `template` : le modèle de mission déroulé (une quinzaine d'étapes, phases comprises) ;
 *  - `paste`    : la liste sortie de l'IA, collée telle quelle ;
 *  - `label`    : une étape, à la main.
 *
 * Les étapes s'AJOUTENT toujours à la suite, jamais en remplacement : appliquer
 * un deuxième modèle sur un dossier déjà entamé ne doit pas effacer ce qui a
 * été coché. C'est ce qui permet de composer « Landing page » + « Google Ads »
 * sur un même client sans rien perdre.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  // Le dossier doit exister : sans ce contrôle, une étape orpheline part en
  // erreur de clé étrangère illisible.
  const { data: client } = await supabase.from("clients").select("id").eq("id", id).single();
  if (!client) return NextResponse.json({ error: "dossier introuvable" }, { status: 404 });

  const existing = await readTasks(id);
  let rank = nextRank(existing);
  const rows: Record<string, unknown>[] = [];

  if (body.template !== undefined) {
    const tpl = templateById(body.template);
    if (!tpl) return NextResponse.json({ error: `modèle inconnu (${body.template})` }, { status: 400 });
    for (const s of tpl.steps) {
      rows.push({ client_id: id, label: s.label, phase: s.phase, details: s.details ?? null, rank: rank++ });
    }
  } else if (body.paste !== undefined) {
    const phase = cleanText(body.phase);
    for (const label of parseChecklistPaste(body.paste)) {
      rows.push({ client_id: id, label, phase, rank: rank++ });
    }
    if (!rows.length) return NextResponse.json({ error: "aucune étape lisible dans ce collage" }, { status: 400 });
  } else {
    const label = cleanText(body.label);
    if (!label) return NextResponse.json({ error: "label requis" }, { status: 400 });
    rows.push({
      client_id: id,
      label,
      phase: cleanText(body.phase),
      details: cleanText(body.details),
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date ?? "")) ? body.due_date : null,
      rank: rank++,
    });
  }

  const { error } = await supabase.from("client_tasks").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, added: rows.length, tasks: await readTasks(id) });
}

interface PatchBody {
  task_id?: string;
  done?: boolean;
  label?: string;
  details?: string | null;
  phase?: string | null;
  due_date?: string | null;
  /** Réordonnancement complet : les identifiants dans l'ordre voulu. */
  order?: string[];
}

/**
 * PATCH /api/crm/[id]/tasks — coche, renomme ou réordonne.
 *
 * `done_at` est posé et EFFACÉ ici, jamais saisi : une étape décochée qui garde
 * sa date de réalisation est un mensonge discret, et c'est exactement le genre
 * d'incohérence qu'on ne voit qu'un an plus tard.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  // Réordonnancement : un rang par position, borné au dossier courant.
  if (Array.isArray(body.order)) {
    let i = 0;
    for (const taskId of body.order) {
      const { error } = await supabase
        .from("client_tasks")
        .update({ rank: i++ })
        .eq("id", taskId)
        .eq("client_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, tasks: await readTasks(id) });
  }

  const taskId = cleanText(body.task_id);
  if (!taskId) return NextResponse.json({ error: "task_id requis" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.done !== undefined) {
    patch.done = body.done === true;
    patch.done_at = body.done === true ? new Date().toISOString() : null;
  }
  if (body.label !== undefined) {
    const label = cleanText(body.label);
    if (!label) return NextResponse.json({ error: "le label ne peut pas être vide" }, { status: 400 });
    patch.label = label;
  }
  if (body.details !== undefined) patch.details = cleanText(body.details);
  if (body.phase !== undefined) patch.phase = cleanText(body.phase);
  if (body.due_date !== undefined) {
    patch.due_date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date ?? "")) ? body.due_date : null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "rien à modifier" }, { status: 400 });

  // `eq("client_id", id)` en plus de l'identifiant : une étape ne se modifie
  // que depuis SON dossier, même si l'identifiant fuitait ailleurs.
  const { error } = await supabase.from("client_tasks").update(patch).eq("id", taskId).eq("client_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, tasks: await readTasks(id) });
}

/** DELETE /api/crm/[id]/tasks?task=<uuid> — retire une étape. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  const taskId = req.nextUrl.searchParams.get("task");
  if (!taskId) return NextResponse.json({ error: "paramètre task requis" }, { status: 400 });

  const { error } = await supabase.from("client_tasks").delete().eq("id", taskId).eq("client_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tasks: await readTasks(id) });
}
