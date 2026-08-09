import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { cleanText, parseTarif, echeanceDe, INVOICE_COLS } from "@/app/lib/crm";

export const dynamic = "force-dynamic";

/**
 * Les échéances de maintenance d'un dossier.
 *
 * Une ligne par MOIS facturé. `paid_at` NULL = pas encore encaissé : c'est la
 * seule réponse fiable à « m'a-t-il réglé août ? », et la raison d'être de cette
 * table — la mémoire, elle, arrondit toujours en faveur du client.
 */
async function readInvoices(clientId: string) {
  const { data, error } = await supabase
    .from("client_invoices")
    .select(INVOICE_COLS)
    .eq("client_id", clientId)
    .order("periode", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** La date d'encaissement fournie (`2026-07-29`), sinon l'instant présent. */
function datePaiement(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/** Un mois se désigne par son PREMIER jour — `2026-08` et `2026-08-17` valent août. */
function normalisePeriode(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const m = /^(\d{4})-(\d{2})/.exec(s);
  if (!m) return null;
  const mois = Number(m[2]);
  if (mois < 1 || mois > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, invoices: await readInvoices(id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * POST /api/crm/[id]/invoices — émet l'échéance d'un mois.
 *
 * Le montant par défaut est la maintenance DU DOSSIER : on facture ce qui a été
 * convenu, et le retaper à chaque mois serait douze occasions de se tromper.
 * L'échéance tombe 30 jours plus tard, conforme au délai de paiement usuel.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: {
    periode?: string; montant_ht?: string | number; due_date?: string; numero?: string; libelle?: string;
    /** Émettre ET encaisser d'un coup — pour rattraper un mois déjà réglé. */
    paid?: boolean;
    /** La date RÉELLE de l'encaissement (`2026-07-29`). Sans elle, maintenant. */
    paid_at?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const periode = normalisePeriode(body.periode);
  if (!periode) return NextResponse.json({ error: `période invalide (${body.periode})` }, { status: 400 });

  const { data: client, error: errClient } = await supabase
    .from("clients")
    .select("id, nom, maintenance_ht, maintenance_day")
    .eq("id", id)
    .single();
  if (errClient || !client) return NextResponse.json({ error: "dossier introuvable" }, { status: 404 });

  const montant = parseTarif(body.montant_ht) ?? parseTarif((client as { maintenance_ht: unknown }).maintenance_ht);
  if (montant === null) {
    return NextResponse.json({ error: "aucun montant : renseigner la maintenance mensuelle du dossier" }, { status: 400 });
  }

  // L'échéance suit le JOUR convenu avec le client (« le 29 »), pas un délai
  // calculé — c'est ce jour-là qui rend le mot « en retard » défendable.
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date ?? ""))
    ? String(body.due_date)
    : echeanceDe(periode, (client as { maintenance_day: number | null }).maintenance_day);

  const { error } = await supabase.from("client_invoices").insert({
    client_id: id,
    periode,
    montant_ht: montant,
    due_date: due,
    numero: cleanText(body.numero),
    libelle: cleanText(body.libelle) ?? "Maintenance mensuelle",
    // Un mois rattrapé se date au JOUR où l'argent est arrivé, pas au jour de la
    // saisie : « payé le 29/07 » consigné le 9 août ferait mentir l'historique,
    // et c'est cet historique qui sert à dire si un client paie en retard.
    paid_at: body.paid === true ? datePaiement(body.paid_at) : null,
  });
  if (error) {
    // L'index unique (client, période) : ce mois est déjà facturé. Ce n'est pas
    // une panne, c'est le doublon qu'un client remarquerait tout de suite.
    const doublon = /duplicate|unique/i.test(error.message);
    return NextResponse.json(
      { error: doublon ? "Ce mois est déjà facturé." : error.message },
      { status: doublon ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true, invoices: await readInvoices(id) });
}

/**
 * PATCH /api/crm/[id]/invoices — encaisse ou dés-encaisse une échéance.
 *
 * `paid` bascule `paid_at` : posé par le serveur, jamais saisi. Une facture
 * marquée payée sans date ne dirait pas QUAND, donc ne permettrait pas de
 * relancer — même règle que `done_at` sur les étapes.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: { invoice_id?: string; paid?: boolean; montant_ht?: string | number; due_date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const invoiceId = cleanText(body.invoice_id);
  if (!invoiceId) return NextResponse.json({ error: "invoice_id requis" }, { status: 400 });

  const champs: Record<string, unknown> = {};
  if (typeof body.paid === "boolean") champs.paid_at = body.paid ? new Date().toISOString() : null;
  if (body.montant_ht !== undefined) champs.montant_ht = parseTarif(body.montant_ht);
  if (body.due_date !== undefined) {
    champs.due_date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date)) ? body.due_date : null;
  }
  if (!Object.keys(champs).length) return NextResponse.json({ error: "rien à modifier" }, { status: 400 });

  const { error } = await supabase
    .from("client_invoices")
    .update(champs)
    .eq("id", invoiceId)
    .eq("client_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, invoices: await readInvoices(id) });
}

/** DELETE /api/crm/[id]/invoices?invoice=<uuid> — retire une échéance émise par erreur. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  const invoiceId = req.nextUrl.searchParams.get("invoice");
  if (!invoiceId) return NextResponse.json({ error: "paramètre invoice requis" }, { status: 400 });

  const { error } = await supabase.from("client_invoices").delete().eq("id", invoiceId).eq("client_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, invoices: await readInvoices(id) });
}
