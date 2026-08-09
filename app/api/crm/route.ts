import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { copierPhotoInstagram } from "@/app/lib/crmPhoto";
import {
  parseClientStatus, cleanText, normalizeUrl, parseTarif, crmTotals,
  clientFromProspect, progress, nextAction, lastActivityAt, CLIENT_COLS, INVOICE_COLS, SERVICE_COLS,
  type ProspectSeed, type Invoice, type ClientService,
} from "@/app/lib/crm";

/** Ce que la reprise d'un prospect Instagram recopie — photo de profil comprise. */
const SEED_COLS = "id, username, full_name, metier, ville, external_url, profile_pic_url, last_dm_at";

export const dynamic = "force-dynamic";

/** Le strict nécessaire d'une étape pour composer une carte du tableau. */
interface TaskLite {
  client_id: string;
  label: string;
  rank: number;
  done: boolean;
  done_at: string | null;
}

/**
 * GET /api/crm — la liste des dossiers, leurs avancements, les totaux, et les
 * prospects Instagram BOOKÉS pas encore repris en dossier.
 *
 * Les candidats voyagent avec la liste plutôt que dans une route à part : le
 * seul écran qui s'en sert est celui-ci, et un aller-retour de moins sur une
 * page ouverte vingt fois par jour vaut mieux qu'une route de plus à protéger.
 */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  try {
    const [clientsRes, tasksRes, notesRes, invoicesRes, servicesRes] = await Promise.all([
      supabase.from("clients").select(CLIENT_COLS).order("created_at", { ascending: false }).limit(500),
      supabase.from("client_tasks").select("client_id, label, rank, done, done_at").limit(10_000),
      supabase.from("client_notes").select("client_id, at").limit(10_000),
      // Les échéances voyagent avec la liste : la section supervision doit dire
      // qui n'a pas payé SANS ouvrir douze fiches.
      supabase.from("client_invoices").select(INVOICE_COLS).order("periode", { ascending: false }).limit(2_000),
      supabase.from("client_services").select(SERVICE_COLS).limit(2_000),
    ]);
    if (clientsRes.error) return NextResponse.json({ error: clientsRes.error.message }, { status: 500 });

    const clients = (clientsRes.data ?? []) as Record<string, unknown>[];
    const tasks = (tasksRes.data ?? []) as TaskLite[];
    const notes = (notesRes.data ?? []) as { client_id: string; at: string }[];
    const invoices = (invoicesRes.data ?? []) as Invoice[];
    const services = (servicesRes.data ?? []) as ClientService[];

    // Étapes et notes rangées par dossier en une passe — le tableau a besoin des
    // trois à la fois (avancement, prochaine étape, dernier geste).
    const tasksOf = new Map<string, TaskLite[]>();
    for (const t of tasks) {
      const b = tasksOf.get(t.client_id);
      if (b) b.push(t); else tasksOf.set(t.client_id, [t]);
    }
    const notesOf = new Map<string, string[]>();
    for (const n of notes) {
      const b = notesOf.get(n.client_id);
      if (b) b.push(n.at); else notesOf.set(n.client_id, [n.at]);
    }

    const invoicesOf = new Map<string, Invoice[]>();
    for (const f of invoices) {
      const b = invoicesOf.get(f.client_id);
      if (b) b.push(f); else invoicesOf.set(f.client_id, [f]);
    }
    const servicesOf = new Map<string, ClientService[]>();
    for (const s of services) {
      const b = servicesOf.get(s.client_id);
      if (b) b.push(s); else servicesOf.set(s.client_id, [s]);
    }

    const rows = clients.map((c) => {
      const id = c.id as string;
      const ts = tasksOf.get(id) ?? [];
      return {
        ...c,
        progress: progress(ts),
        next_action: nextAction(ts),
        invoices: invoicesOf.get(id) ?? [],
        services: servicesOf.get(id) ?? [],
        // Le dernier GESTE, pas le dernier enregistrement : `updated_at` bouge
        // dès qu'on corrige un numéro de téléphone, ce qui rafraîchirait
        // éternellement un dossier où plus rien n'avance.
        last_activity: lastActivityAt([
          ...ts.map((t) => t.done_at),
          ...(notesOf.get(id) ?? []),
          c.started_at as string | null,
          c.created_at as string,
        ]),
      };
    });

    return NextResponse.json({
      clients: rows,
      totals: crmTotals(clients as { statut: string; tarif_ht: number | null }[]),
      candidates: await bookedProspects(clients),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * Les prospects Instagram au stade `call_booke` qui n'ont pas encore de dossier.
 *
 * Le stade `call_booke` et LUI SEUL : un prospect en pleine conversation n'est
 * pas un client, et le proposer ici ferait ouvrir des dossiers sur des espoirs.
 * C'est la même frontière que côté KPI — on ne compte pas ce qui n'a pas eu lieu.
 */
async function bookedProspects(existing: Record<string, unknown>[]) {
  const deja = new Set(existing.map((c) => c.instagram_prospect_id).filter(Boolean) as string[]);
  const { data } = await supabase
    .from("instagram_prospects")
    .select(SEED_COLS)
    .eq("stage", "call_booke")
    .order("last_dm_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as ProspectSeed[]).filter((p) => !deja.has(p.id));
}

interface Body {
  nom?: string;
  contact?: string;
  email?: string;
  telephone?: string;
  site_url?: string;
  image_url?: string;
  metier?: string;
  ville?: string;
  description?: string;
  statut?: string;
  source?: string;
  tarif_ht?: string | number | null;
  recurrent?: boolean;
  started_at?: string | null;
  /** Reprise d'un prospect Instagram booké : le reste du dossier en est déduit. */
  instagram_prospect_id?: string;
}

/**
 * POST /api/crm — ouvre un dossier.
 *
 * Deux entrées, un seul chemin d'écriture :
 *  - `instagram_prospect_id` seul → le dossier est pré-rempli depuis le prospect ;
 *  - `nom` (+ le reste) → saisie libre, pour tout client venu d'ailleurs.
 * Les champs explicitement fournis l'emportent toujours sur ce qui est déduit :
 * on corrige un nom mal orthographié au moment de l'import, pas après.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  let seed: Record<string, unknown> = {};
  let seedProspect: { id: string; username: string; profile_pic_url?: string | null } | null = null;
  const prospectId = cleanText(body.instagram_prospect_id);
  if (prospectId) {
    const { data: p, error } = await supabase
      .from("instagram_prospects")
      .select(SEED_COLS)
      .eq("id", prospectId)
      .single();
    if (error || !p) return NextResponse.json({ error: "prospect introuvable" }, { status: 404 });
    seed = { ...clientFromProspect(p as ProspectSeed) };
    seedProspect = p as { id: string; username: string; profile_pic_url?: string | null };
  }

  const nom = cleanText(body.nom) ?? (seed.nom as string | undefined);
  if (!nom) return NextResponse.json({ error: "nom requis" }, { status: 400 });

  const statut = parseClientStatus(body.statut ?? "piste");
  if (!statut) return NextResponse.json({ error: `statut invalide (${body.statut})` }, { status: 400 });

  const row = {
    ...seed,
    nom,
    contact: cleanText(body.contact),
    email: cleanText(body.email),
    telephone: cleanText(body.telephone),
    site_url: normalizeUrl(body.site_url) ?? (seed.site_url as string | null) ?? null,
    // La photo saisie l'emporte, sinon celle du prospect : reprendre un compte
    // Instagram sans son visage donnerait une carte anonyme dès l'ouverture.
    image_url: normalizeUrl(body.image_url) ?? (seed.image_url as string | null) ?? null,
    metier: cleanText(body.metier) ?? (seed.metier as string | null) ?? null,
    ville: cleanText(body.ville) ?? (seed.ville as string | null) ?? null,
    description: cleanText(body.description) ?? (seed.description as string | undefined) ?? "",
    statut,
    source: cleanText(body.source) ?? (seed.source as string | null) ?? null,
    tarif_ht: parseTarif(body.tarif_ht),
    recurrent: body.recurrent === true,
    started_at: /^\d{4}-\d{2}-\d{2}$/.test(String(body.started_at ?? "")) ? body.started_at : null,
  };

  const { data, error } = await supabase.from("clients").insert(row).select(CLIENT_COLS).single();
  // La photo du prospect est COPIÉE chez nous dès l'ouverture du dossier : les
  // liens Instagram sont signés et périment, un dossier ouvert aujourd'hui
  // serait sans visage dans trois semaines. Best-effort — un dossier ne doit
  // jamais échouer à s'ouvrir parce qu'une image manque.
  if (!error && data && prospectId) {
    const p = seedProspect;
    if (p) void copierPhotoInstagram((data as { id: string }).id, p).catch(() => undefined);
  }
  if (error) {
    // L'index unique partiel sur `instagram_prospect_id` : ce prospect a déjà
    // son dossier. Ce n'est pas une panne, c'est un doublon évité.
    const conflict = /duplicate|unique/i.test(error.message);
    return NextResponse.json(
      { error: conflict ? "Ce prospect a déjà un dossier client." : error.message },
      { status: conflict ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true, client: data });
}
