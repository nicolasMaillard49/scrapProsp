import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { cleanText, parseTarif, nextRank, SERVICE_COLS, TASK_COLS } from "@/app/lib/crm";
import { serviceByCode, etapesAAjouter, customServiceCode } from "@/app/lib/crmServices";

export const dynamic = "force-dynamic";

async function readServices(clientId: string) {
  const { data, error } = await supabase
    .from("client_services")
    .select(SERVICE_COLS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, services: await readServices(id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * POST /api/crm/[id]/services — ajoute une prestation vendue.
 *
 * Le LIBELLÉ et le MONTANT sont figés à l'ajout, depuis le catalogue : un tarif
 * qui bouge plus tard ne doit pas réécrire ce qu'on a facturé l'an dernier. Le
 * code, lui, reste la clé de comptage (« combien de sites vitrine ce trimestre »).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: { code?: string; label?: string; montant_ht?: string | number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const requestedCode = cleanText(body.code);
  const customLabel = cleanText(body.label);
  const catalogDef = requestedCode ? serviceByCode(requestedCode) : null;
  const customCode = !requestedCode && customLabel ? customServiceCode(customLabel) : null;
  if (!catalogDef && !customCode) {
    return NextResponse.json({ error: requestedCode ? `prestation inconnue (${body.code})` : "libellé requis" }, { status: 400 });
  }

  const def = catalogDef ?? {
    code: customCode!, label: customLabel!, montant: null, groupe: "Suivi" as const,
  };

  const montant = body.montant_ht !== undefined ? parseTarif(body.montant_ht) : def.montant;

  const { error } = await supabase
    .from("client_services")
    .insert({ client_id: id, code: def.code, label: def.label, montant_ht: montant });
  if (error) {
    const doublon = /duplicate|unique/i.test(error.message);
    return NextResponse.json(
      { error: doublon ? "Cette prestation est déjà au dossier." : error.message },
      { status: doublon ? 409 : 500 },
    );
  }

  // Vendre une prestation, c'est s'engager sur des étapes précises. Les
  // recomposer à la main à chaque dossier, c'est en oublier une à chaque fois :
  // la checklist du service s'ajoute ici, À LA SUITE et sans jamais toucher à ce
  // qui est déjà coché.
  const { data: existantes } = await supabase
    .from("client_tasks")
    .select("label, rank")
    .eq("client_id", id)
    .limit(500);
  const deja = (existantes ?? []) as { label: string; rank: number }[];
  const nouvelles = etapesAAjouter(def.code, deja);
  let rang = nextRank(deja);
  if (nouvelles.length) {
    await supabase.from("client_tasks").insert(
      nouvelles.map((e) => ({ client_id: id, label: e.label, phase: e.phase, rank: rang++ })),
    );
  }

  const { data: tasks } = await supabase
    .from("client_tasks")
    .select(TASK_COLS)
    .eq("client_id", id)
    .order("rank", { ascending: true })
    .limit(500);

  return NextResponse.json({
    ok: true,
    services: await readServices(id),
    tasks: tasks ?? [],
    ajoutees: nouvelles.length,
  });
}

/** PATCH — corrige le montant réellement convenu (une remise, un devis sur mesure). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: { service_id?: string; montant_ht?: string | number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const serviceId = cleanText(body.service_id);
  if (!serviceId) return NextResponse.json({ error: "service_id requis" }, { status: 400 });

  const { error } = await supabase
    .from("client_services")
    .update({ montant_ht: parseTarif(body.montant_ht) })
    .eq("id", serviceId)
    .eq("client_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, services: await readServices(id) });
}

/** DELETE /api/crm/[id]/services?service=<uuid> — retire une prestation ajoutée à tort. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  const serviceId = req.nextUrl.searchParams.get("service");
  if (!serviceId) return NextResponse.json({ error: "paramètre service requis" }, { status: 400 });

  const { error } = await supabase.from("client_services").delete().eq("id", serviceId).eq("client_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, services: await readServices(id) });
}
