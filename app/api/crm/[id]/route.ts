import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import {
  parseClientStatus, cleanText, normalizeUrl, parseTarif, parseJourEcheance, isClosed, progress,
  CLIENT_COLS, TASK_COLS, NOTE_COLS, INVOICE_COLS, SERVICE_COLS, DOCUMENT_COLS,
  type ClientDocument,
} from "@/app/lib/crm";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/crm/[id] — LE dossier : identité, checklist, journal, et le prospect
 * Instagram d'origine s'il y en a un.
 *
 * Tout arrive en une fois. Un dossier est fait pour être ouvert et lu en entier
 * (c'est même sa raison d'être : ne plus avoir à chercher ailleurs) — le
 * découper en trois appels ferait clignoter l'écran sans rien économiser.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  const { data: client, error } = await supabase.from("clients").select(CLIENT_COLS).eq("id", id).single();
  if (error || !client) return NextResponse.json({ error: "dossier introuvable" }, { status: 404 });

  const [tasksRes, notesRes, invoicesRes, servicesRes, docsRes] = await Promise.all([
    supabase.from("client_tasks").select(TASK_COLS).eq("client_id", id).order("rank", { ascending: true }).limit(500),
    supabase.from("client_notes").select(NOTE_COLS).eq("client_id", id).order("at", { ascending: false }).limit(300),
    supabase.from("client_invoices").select(INVOICE_COLS).eq("client_id", id).order("periode", { ascending: false }).limit(60),
    supabase.from("client_services").select(SERVICE_COLS).eq("client_id", id).order("created_at", { ascending: true }).limit(50),
    supabase.from("client_documents").select(DOCUMENT_COLS).eq("client_id", id).order("created_at", { ascending: false }).limit(100),
  ]);

  // Les liens de lecture sont SIGNÉS et expirent : le bucket est privé, et un
  // audit nomme des chiffres d'affaires. Ils se fabriquent donc à chaque
  // ouverture du dossier, jamais en base.
  const documents = await Promise.all(
    ((docsRes.data ?? []) as ClientDocument[]).map(async (d) => {
      if (!supabaseAdminConfigured) return { ...d, url: null };
      const { data: signed } = await supabaseAdmin.storage.from("crm").createSignedUrl(d.path, 3600);
      return { ...d, url: signed?.signedUrl ?? null };
    }),
  );

  const tasks = (tasksRes.data ?? []) as { done: boolean }[];

  // Le prospect d'origine, quand le dossier en vient. Lecture BEST-EFFORT :
  // le prospect a pu être supprimé de la base de prospection (la FK est en
  // `SET NULL`), le dossier doit s'ouvrir quand même.
  let prospect = null;
  const pid = (client as Record<string, unknown>).instagram_prospect_id as string | null;
  if (pid) {
    const { data } = await supabase
      .from("instagram_prospects")
      .select("id, username, full_name, metier, ville, followers, stage, status, score, external_url")
      .eq("id", pid)
      .single();
    prospect = data ?? null;
  }

  return NextResponse.json({
    client,
    tasks: tasksRes.data ?? [],
    notes: notesRes.data ?? [],
    invoices: invoicesRes.data ?? [],
    services: servicesRes.data ?? [],
    documents,
    prospect,
    progress: progress(tasks),
  });
}

interface Patch {
  nom?: string;
  contact?: string | null;
  email?: string | null;
  telephone?: string | null;
  site_url?: string | null;
  image_url?: string | null;
  metier?: string | null;
  ville?: string | null;
  description?: string;
  statut?: string;
  source?: string | null;
  tarif_ht?: string | number | null;
  maintenance_ht?: string | number | null;
  maintenance_day?: string | number | null;
  recurrent?: boolean;
  started_at?: string | null;
  closed_at?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * PATCH /api/crm/[id] — modifie ce qui est fourni, et RIEN d'autre.
 *
 * Chaque champ n'est touché que s'il est présent dans le corps : l'écran
 * enregistre champ par champ (une sortie de champ = un PATCH), et un objet
 * complet écraserait de vrais contenus par les `undefined` d'un formulaire
 * partiellement rempli.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: Patch;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.nom !== undefined) {
    const nom = cleanText(body.nom);
    if (!nom) return NextResponse.json({ error: "le nom ne peut pas être vide" }, { status: 400 });
    patch.nom = nom;
  }
  for (const k of ["contact", "email", "telephone", "metier", "ville", "source"] as const) {
    if (body[k] !== undefined) patch[k] = cleanText(body[k]);
  }
  if (body.site_url !== undefined) patch.site_url = normalizeUrl(body.site_url);
  if (body.image_url !== undefined) patch.image_url = normalizeUrl(body.image_url);
  if (body.description !== undefined) patch.description = String(body.description ?? "");
  if (body.tarif_ht !== undefined) patch.tarif_ht = parseTarif(body.tarif_ht);
  // Le MONTANT mensuel commande tout : `recurrent` en découle au lieu d'être une
  // seconde case à cocher. Deux interrupteurs pour une seule idée, c'est celui
  // qu'on oublie qui décide — et un dossier « en abonnement » à 0 € ne serait
  // jamais réclamé.
  if (body.maintenance_ht !== undefined) {
    const m = parseTarif(body.maintenance_ht);
    patch.maintenance_ht = m;
    patch.recurrent = m !== null && m > 0;
  }
  if (body.maintenance_day !== undefined) patch.maintenance_day = parseJourEcheance(body.maintenance_day);
  if (body.recurrent !== undefined && body.maintenance_ht === undefined) patch.recurrent = body.recurrent === true;
  if (body.started_at !== undefined) patch.started_at = DATE_RE.test(String(body.started_at ?? "")) ? body.started_at : null;
  if (body.closed_at !== undefined) patch.closed_at = DATE_RE.test(String(body.closed_at ?? "")) ? body.closed_at : null;

  if (body.statut !== undefined) {
    const statut = parseClientStatus(body.statut);
    if (!statut) return NextResponse.json({ error: `statut invalide (${body.statut})` }, { status: 400 });
    patch.statut = statut;
    // La date de clôture SUIT le statut, sauf si elle est fournie explicitement
    // (le `closed_at` du corps l'emporte toujours). La demander en plus
    // laisserait des dossiers « terminés » sans date de fin, et le premier
    // bilan de fin d'année buterait dessus. Symétriquement, un dossier rouvert
    // perd sa date de fin : la garder ferait mentir sa ligne du temps.
    if (body.closed_at === undefined) {
      patch.closed_at = isClosed(statut) ? new Date().toISOString().slice(0, 10) : null;
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "rien à modifier" }, { status: 400 });

  const { data, error } = await supabase.from("clients").update(patch).eq("id", id).select(CLIENT_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, client: data });
}

/**
 * DELETE /api/crm/[id] — supprime le dossier, sa checklist et son journal
 * (cascade en base). Le prospect Instagram d'origine, lui, n'est PAS touché :
 * il retournera simplement dans les candidats à reprendre.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
