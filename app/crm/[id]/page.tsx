"use client";

// LA FICHE CLIENT — le dossier ouvert.
//
// Un seul écran doit répondre à « où en est-on avec lui ? » sans rien ouvrir
// d'autre : qui c'est, ce qu'on lui a vendu, ce qu'il reste à faire, ce qui
// s'est dit. Les trois blocs sont dans cet ordre parce que c'est l'ordre dans
// lequel on se pose les questions.
//
// Tout s'enregistre en sortie de champ (`AutoField`) : pas de bouton
// « Enregistrer », donc pas de correction perdue faute d'avoir cliqué.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Trash2, ExternalLink, Plus, ClipboardPaste,
  ListChecks, CalendarDays, Phone, Mail, Globe, Check, X, MessageSquare, MessageCircle, Sparkles, Upload, FileText,
} from "lucide-react";
import {
  CLIENT_STATUSES, CLIENT_STATUS_LABEL, CLIENT_STATUS_HINT, clientTone, progress,
  NOTE_KINDS, NOTE_KIND_LABEL, DOC_KINDS, DOC_KIND_LABEL, poidsFr, parseTarif, waLink, messageErreur,
  type NoteKind, type ClientDocument,
} from "@/app/lib/crm";
import { MISSION_TEMPLATES } from "@/app/lib/crmTemplates";
import { SERVICES, SERVICE_GROUPES, serviceByCode, totalPrestations, livrablesManquants } from "@/app/lib/crmServices";
import { TONE_CLASS, euros, dateFr, type Client, type Task, type Note, type LinkedProspect, type ClientService } from "../types";
import { Avatar, AutoField, Champ, INPUT, IgIcon } from "../ui";

export default function FicheClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [prospect, setProspect] = useState<LinkedProspect | null>(null);
  const [services, setServices] = useState<ClientService[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/crm/${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(messageErreur(j, r.status));
      setClient(j.client);
      setTasks(j.tasks ?? []);
      setNotes(j.notes ?? []);
      setServices(j.services ?? []);
      setDocuments(j.documents ?? []);
      setProspect(j.prospect ?? null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  /** Enregistre un champ du dossier et reprend la version rendue par le serveur. */
  const patch = useCallback(async (champ: Record<string, unknown>) => {
    const r = await fetch(`/api/crm/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(champ),
    });
    const j = await r.json();
    if (!r.ok) { setError(messageErreur(j, r.status)); return; }
    setError("");
    // Le serveur normalise (URL complétée, tarif nettoyé, date de clôture posée
    // par le statut) : reprendre SA version évite d'afficher la saisie brute
    // pendant que la base contient autre chose.
    setClient(j.client);
  }, [id]);

  const prog = useMemo(() => progress(tasks), [tasks]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-[var(--color-text-muted)]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Ouverture du dossier…
      </main>
    );
  }
  if (!client) {
    return (
      <main className="min-h-screen px-4 py-10 max-w-2xl mx-auto text-center">
        <p className="text-sm text-rose-500 mb-4">{error || "Dossier introuvable."}</p>
        <Link href="/crm" className="text-sm text-violet-500 hover:underline">← Retour aux clients</Link>
      </main>
    );
  }

  const tone = clientTone(client.statut);

  async function supprimer() {
    if (!confirm(`Supprimer définitivement le dossier « ${client!.nom} » ?\n\nSa checklist et son journal partent avec. Le prospect Instagram, lui, reste en base.`)) return;
    const r = await fetch(`/api/crm/${id}`, { method: "DELETE" });
    if (r.ok) router.push("/crm");
    else setError("Suppression impossible.");
  }

  return (
    <main className="min-h-screen w-full px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center gap-3 mb-5">
        <Link
          href="/crm"
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-violet-500 hover:border-violet-500/50 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Clients
        </Link>
        <div className="mr-auto" />
        <select
          value={client.statut}
          onChange={(e) => void patch({ statut: e.target.value })}
          className={`px-2.5 py-1.5 text-sm rounded-lg border bg-[var(--color-surface)] outline-none ${TONE_CLASS[tone]}`}
        >
          {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{CLIENT_STATUS_LABEL[s]}</option>)}
        </select>
        <button onClick={supprimer} className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-rose-500 hover:border-rose-500/50 transition" title="Supprimer le dossier">
          <Trash2 className="w-4 h-4" />
        </button>
      </header>

      {error && <div className="mb-4 px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-500/10 text-sm text-rose-500">{error}</div>}

      {/* ── En-tête du dossier ── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-4">
        <div className="flex items-start gap-4">
          <Avatar url={client.image_url} nom={client.nom} size={72} />
          <div className="flex-1 min-w-0">
            <AutoField
              value={client.nom}
              onSave={(v) => patch({ nom: v })}
              className="!text-lg !font-medium !bg-transparent !border-transparent hover:!border-[var(--color-border)] !px-1"
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 px-1 text-xs text-[var(--color-text-muted)]">
              <span>{[client.metier, client.ville].filter(Boolean).join(" · ") || "métier et ville à renseigner"}</span>
              {client.site_url && (
                <a href={client.site_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-violet-500 hover:underline">
                  <Globe className="w-3 h-3" /> site <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <span>Ouvert le {dateFr(client.created_at)}</span>
            </div>
            <p className="mt-2 px-1 text-xs text-[var(--color-text-muted)]">
              {CLIENT_STATUS_HINT[client.statut as keyof typeof CLIENT_STATUS_HINT]}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono-num text-2xl text-[var(--color-text-primary)]">{euros(client.tarif_ht)}</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {/* Le forfait et le mensuel s'affichent CÔTE À CÔTE et jamais
                  additionnés : leur somme n'existe sur aucun relevé. */}
              forfait{client.maintenance_ht ? ` · + ${euros(client.maintenance_ht)} /mois` : ""}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
        {/* ── Colonne principale : checklist + journal ── */}
        <div className="flex flex-col gap-4 min-w-0">
          <Prestations
            clientId={id}
            services={services}
            setServices={setServices}
            setTasks={setTasks}
            tarifDossier={client.tarif_ht}
            onTarif={(v) => patch({ tarif_ht: v })}
            onError={setError}
          />
          <Checklist clientId={id} tasks={tasks} setTasks={setTasks} prog={prog} onError={setError} />
          <Pieces clientId={id} documents={documents} setDocuments={setDocuments} tasks={tasks} onError={setError} />
          <Journal clientId={id} notes={notes} setNotes={setNotes} onError={setError} />
        </div>

        {/* ── Colonne latérale : identité, argent, origine ── */}
        <aside className="flex flex-col gap-4">
          <Bloc titre="Coordonnées">
            <Recuperation
              clientId={id}
              client={client}
              onClient={setClient}
              onError={setError}
            />
            <div className="grid gap-3">
              <Champ label="Interlocuteur"><AutoField value={client.contact} onSave={(v) => patch({ contact: v })} placeholder="Prénom, rôle" /></Champ>
              <Champ label="Téléphone"><AutoField value={client.telephone} onSave={(v) => patch({ telephone: v })} placeholder="06 12 34 56 78" /></Champ>
              <Champ label="Email"><AutoField value={client.email} onSave={(v) => patch({ email: v })} type="email" /></Champ>
              <Champ label="Site"><AutoField value={client.site_url} onSave={(v) => patch({ site_url: v })} placeholder="gpelec.fr" /></Champ>
              <Champ label="Logo / photo (URL)"><AutoField value={client.image_url} onSave={(v) => patch({ image_url: v })} placeholder="https://…" /></Champ>
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Métier"><AutoField value={client.metier} onSave={(v) => patch({ metier: v })} /></Champ>
                <Champ label="Ville"><AutoField value={client.ville} onSave={(v) => patch({ ville: v })} /></Champ>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {client.telephone && <a href={`tel:${client.telephone.replace(/\s/g, "")}`} className="flex items-center gap-1 text-violet-500 hover:underline"><Phone className="w-3 h-3" /> Appeler</a>}
                {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1 text-violet-500 hover:underline"><Mail className="w-3 h-3" /> Écrire</a>}
                {/* WhatsApp : le canal réel de la plupart des artisans — c'est par
                    là que passent les allers-retours, pas par l'email. */}
                {waLink(client.telephone) && (
                  <a href={waLink(client.telephone)!} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-500 hover:underline">
                    <MessageCircle className="w-3 h-3" /> WhatsApp
                  </a>
                )}
              </div>
            </div>
          </Bloc>

          <Bloc titre="Mission">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Tarif € HT"><AutoField value={client.tarif_ht == null ? "" : String(client.tarif_ht)} onSave={(v) => patch({ tarif_ht: v })} mono placeholder="500" /></Champ>
                <Champ label="Origine"><AutoField value={client.source} onSave={(v) => patch({ source: v })} placeholder="audit" /></Champ>
              </div>
              {/* Le montant mensuel EST l'interrupteur de la supervision : une
                  case « abonnement » à part serait un second réglage pour la
                  même idée, et c'est celui qu'on oublie qui déciderait. */}
              <div className="grid grid-cols-2 gap-3">
                {/* `?? ""` et non `=== null` : une colonne absente de la
                    requête vaut `undefined`, et `String(undefined)` afficherait
                    « undefined » dans le champ. */}
                <Champ label="Maintenance € HT / mois">
                  <AutoField
                    value={client.maintenance_ht == null ? "" : String(client.maintenance_ht)}
                    onSave={(v) => patch({ maintenance_ht: v })}
                    mono
                    placeholder="29"
                  />
                </Champ>
                <Champ label="Échéance le (jour du mois)">
                  <AutoField
                    value={client.maintenance_day == null ? "" : String(client.maintenance_day)}
                    onSave={(v) => patch({ maintenance_day: v })}
                    mono
                    placeholder="29"
                  />
                </Champ>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] -mt-1">
                {client.maintenance_ht
                  ? `Suivi dans « sous supervision », échéance le ${client.maintenance_day ?? 30} de chaque mois.`
                  : "Un montant mensuel fait entrer le dossier dans le suivi des paiements."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Début"><AutoField value={client.started_at} onSave={(v) => patch({ started_at: v })} type="date" /></Champ>
                <Champ label="Clôture"><AutoField value={client.closed_at} onSave={(v) => patch({ closed_at: v })} type="date" /></Champ>
              </div>
              <Champ label="Contexte">
                <AutoField value={client.description} onSave={(v) => patch({ description: v })} multiline placeholder="Ce qu'il veut, ce qu'on lui a promis, ce qui coince." />
              </Champ>
            </div>
          </Bloc>

          {prospect && (
            <Bloc titre="Venu d'Instagram">
              <Link
                href={`/instagram?q=${encodeURIComponent(prospect.username)}`}
                className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] hover:text-violet-500 transition"
              >
                <IgIcon className="w-4 h-4 text-violet-500" />
                @{prospect.username}
              </Link>
              <div className="mt-2 text-xs text-[var(--color-text-muted)] space-y-0.5">
                {prospect.followers !== null && <div>{prospect.followers.toLocaleString("fr-FR")} abonnés</div>}
                {prospect.score !== null && <div>Score d'opportunité {prospect.score}/100</div>}
                <div>Stade de prospection : {prospect.stage ?? "—"}</div>
              </div>
              <a
                href={`https://www.instagram.com/${prospect.username}/`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-violet-500 hover:underline"
              >
                Ouvrir le profil <ExternalLink className="w-3 h-3" />
              </a>
            </Bloc>
          )}
        </aside>
      </div>
    </main>
  );
}

/* ── Coque de bloc ───────────────────────────────────────────────────────── */

function Bloc({ titre, children, action }: { titre: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center mb-3">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mr-auto">{titre}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ── Récupération des infos à la source ──────────────────────────────────── */

/**
 * « Récupérer les infos » — Instagram ou fiche Google.
 *
 * Retaper un téléphone, une adresse et un site qu'une source publique connaît
 * déjà, c'est trois occasions de se tromper. Deux réserves, qui font toute la
 * différence entre un outil utile et un outil dangereux :
 *  - seuls les champs VIDES sont remplis, la saisie à la main l'emporte ;
 *  - ce que la source dit AUTREMENT est signalé, jamais appliqué en douce.
 */
function Recuperation({
  clientId, client, onClient, onError,
}: {
  clientId: string;
  client: Client;
  onClient: (c: Client) => void;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [bilan, setBilan] = useState<{ remplis: string[]; ignores: string[]; resume: string | null } | null>(null);

  async function recuperer(source: "instagram" | "google") {
    setBusy(source);
    setBilan(null);
    try {
      const r = await fetch(`/api/crm/${clientId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { onError(messageErreur(j, r.status)); return; }
      onClient(j.client);
      setBilan({ remplis: j.remplis ?? [], ignores: j.ignores ?? [], resume: j.resume ?? null });
      onError("");
    } finally {
      setBusy(null);
    }
  }

  const dispoGoogle = !!(client.metier && client.ville);

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        {client.instagram_prospect_id && (
          <button
            onClick={() => void recuperer("instagram")}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-violet-500/50 hover:text-violet-500 transition-colors motion-reduce:transition-none disabled:opacity-50"
          >
            {busy === "instagram" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IgIcon className="w-3.5 h-3.5" />}
            Récupérer depuis Instagram
          </button>
        )}
        <button
          onClick={() => void recuperer("google")}
          disabled={busy !== null || !dispoGoogle}
          title={dispoGoogle ? "Cherche la fiche Google du métier dans la ville, puis rapproche par nom" : "Renseigner métier et ville d'abord"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-violet-500/50 hover:text-violet-500 transition-colors motion-reduce:transition-none disabled:opacity-40"
        >
          {busy === "google" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
          Récupérer la fiche Google
        </button>
      </div>

      {bilan && (
        <div className="mt-2 text-[11px] leading-snug">
          {bilan.resume && <p className="text-[var(--color-text-secondary)]">{bilan.resume}</p>}
          <p className={bilan.remplis.length ? "text-emerald-500" : "text-[var(--color-text-muted)]"}>
            {bilan.remplis.length
              ? `Rempli : ${bilan.remplis.join(", ")}`
              : "Rien à remplir — tout était déjà saisi."}
          </p>
          {bilan.ignores.length > 0 && (
            <p className="text-amber-500">
              La source dit autre chose pour {bilan.ignores.join(", ")} — ta saisie a été gardée.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Pièces du dossier ───────────────────────────────────────────────────── */

/**
 * Les fichiers du dossier : audits, devis, captures.
 *
 * Un audit qui vit dans `D:\projets\audit\<client>\output\pdf\` n'existe pas
 * pour qui ouvre la fiche — il est refait, ou une version périmée repart chez
 * le client. Ici, il est à un clic. Le bucket est privé, les liens sont signés
 * et expirent au bout d'une heure.
 */
function Pieces({
  clientId, documents, setDocuments, tasks, onError,
}: {
  clientId: string;
  documents: ClientDocument[];
  setDocuments: (d: ClientDocument[]) => void;
  tasks: Task[];
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [survol, setSurvol] = useState(false);
  const [kind, setKind] = useState<string>("audit");
  const input = useRef<HTMLInputElement>(null);

  // Ce qu'une étape cochée aurait dû produire, et qui manque au dossier.
  const manquants = livrablesManquants(tasks, documents);

  async function envoyer(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", kind);
        const r = await fetch(`/api/crm/${clientId}/documents`, { method: "POST", body: form });
        const j = await r.json().catch(() => null);
        if (!r.ok) { onError(messageErreur(j, r.status)); return; }
        setDocuments(j.documents ?? []);
        onError("");
      }
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function retirer(doc: ClientDocument) {
    setBusy(true);
    try {
      const r = await fetch(`/api/crm/${clientId}/documents?doc=${doc.id}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (!r.ok) { onError(messageErreur(j, r.status)); return; }
      setDocuments(j.documents ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Pièces du dossier</h2>
        <span className="text-xs text-[var(--color-text-muted)]">{documents.length}</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Genre de la pièce déposée"
          className="ml-auto px-2 py-1 text-xs rounded-md bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
        >
          {DOC_KINDS.map((k) => <option key={k} value={k}>{DOC_KIND_LABEL[k]}</option>)}
        </select>
      </header>

      {/* La relance : « tu as coché que c'était fait, où est le fichier ? ».
          Un livrable coché sans pièce jointe finit dans un dossier local, il est
          refait six semaines plus tard, ou une version périmée repart au client. */}
      {manquants.map((m) => (
        <button
          key={m.kind}
          onClick={() => { setKind(m.kind); input.current?.click(); }}
          disabled={busy}
          className="w-full mb-2 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-left text-[11px] text-amber-600 dark:text-amber-500 hover:bg-amber-500/15 transition-colors motion-reduce:transition-none disabled:opacity-50"
        >
          <span className="font-medium">« {m.etape} » est coché comme fait</span> — aucun{" "}
          {DOC_KIND_LABEL[m.kind].toLowerCase()} n'est joint au dossier. Cliquer pour le déposer.
        </button>
      ))}

      {documents.length > 0 && (
        <ul className="flex flex-col gap-1.5 mb-3">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-sm">
              <FileText className="w-3.5 h-3.5 shrink-0 text-violet-500" />
              <a
                href={d.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-[var(--color-text-primary)] hover:text-violet-500 transition-colors motion-reduce:transition-none"
              >
                {d.nom}
              </a>
              <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                {DOC_KIND_LABEL[d.kind as keyof typeof DOC_KIND_LABEL] ?? d.kind} · {poidsFr(d.taille)} · {dateFr(d.created_at)}
              </span>
              <button
                onClick={() => void retirer(d)}
                disabled={busy}
                aria-label={`Retirer ${d.nom}`}
                className="ml-auto p-1 rounded text-[var(--color-text-muted)] hover:text-rose-500 transition-colors motion-reduce:transition-none"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => { e.preventDefault(); setSurvol(false); void envoyer(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        className={`flex items-center justify-center gap-2 py-4 rounded-lg border border-dashed text-xs cursor-pointer transition-colors motion-reduce:transition-none ${
          survol
            ? "border-violet-500/60 bg-violet-500/[0.06] text-violet-500"
            : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-violet-500/50"
        }`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {busy ? "Envoi…" : "Glisser un fichier ici, ou cliquer — PDF, image, 25 Mo max"}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        onChange={(e) => void envoyer(e.target.files)}
        className="hidden"
      />
    </section>
  );
}

/* ── Prestations vendues ─────────────────────────────────────────────────── */

/**
 * Ce qu'on a vendu à ce client, coché dans le catalogue de l'agence.
 *
 * Une description libre (« le site plus une page en plus plus des ads ») se lit
 * très bien et ne répond à aucune des questions qui comptent : combien de sites
 * vitrine ce trimestre, quel panier moyen, quelles prestations reviennent. Le
 * catalogue vit en code (`crmServices.ts`), la base ne garde que le choix, son
 * libellé et son montant au moment de la vente.
 */
function Prestations({
  clientId, services, setServices, setTasks, tarifDossier, onTarif, onError,
}: {
  clientId: string;
  services: ClientService[];
  setServices: (s: ClientService[]) => void;
  setTasks: (t: Task[]) => void;
  tarifDossier: number | string | null;
  onTarif: (v: string) => Promise<void>;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [ajout, setAjout] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customMontant, setCustomMontant] = useState("");

  const pris = new Map(services.map((s) => [s.code, s]));
  const total = totalPrestations(services);
  const mensuelles = services.filter((s) => serviceByCode(s.code)?.mensuel);
  const tarif = parseTarif(tarifDossier) ?? 0;
  const ecart = Math.abs(total - tarif) >= 0.01;

  async function appel(code: string, url: string, init: RequestInit): Promise<boolean> {
    setBusy(code);
    try {
      const r = await fetch(url, init);
      const j = await r.json().catch(() => null);
      if (!r.ok) { onError(messageErreur(j, r.status)); return false; }
      setServices(j.services ?? []);
      // La checklist du service arrive avec la réponse : l'écran doit montrer
      // les étapes apparues, sinon l'ajout a l'air sans effet.
      if (j.tasks) setTasks(j.tasks);
      setAjout(j.ajoutees ? `${j.ajoutees} étape${j.ajoutees > 1 ? "s" : ""} ajoutée${j.ajoutees > 1 ? "s" : ""} à la checklist` : "");
      onError("");
      return true;
    } finally {
      setBusy(null);
    }
  }

  const ajouter = (code: string) =>
    appel(code, `/api/crm/${clientId}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

  const retirer = (s: ClientService) =>
    appel(s.code, `/api/crm/${clientId}/services?service=${s.id}`, { method: "DELETE" });

  async function ajouterCustom(e: React.FormEvent) {
    e.preventDefault();
    const label = customLabel.trim();
    if (!label) return;
    const ok = await appel("custom", `/api/crm/${clientId}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, montant_ht: customMontant }),
    });
    if (ok) {
      setCustomLabel("");
      setCustomMontant("");
      setAjout("Prestation personnalisée ajoutée");
    }
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Prestations</h2>
        <span className="text-xs text-[var(--color-text-muted)]">{services.length}</span>
        {total > 0 && (
          <span className="ml-auto font-mono-num text-xs text-[var(--color-text-secondary)]">
            {euros(total)}
            {mensuelles.length > 0 && <span className="text-[var(--color-text-muted)]"> + mensuel</span>}
          </span>
        )}
      </header>

      {/* Deux chiffres qui devraient dire la même chose : ce qu'on a vendu, et
          le tarif du dossier. Quand ils divergent, on le montre et on propose de
          recoller — un écart silencieux entre les deux fausse le CA engagé. */}
      {total > 0 && ecart && (
        <button
          onClick={() => void onTarif(String(total))}
          className="w-full mb-3 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-left text-[11px] text-amber-600 dark:text-amber-500 hover:bg-amber-500/15 transition-colors motion-reduce:transition-none"
        >
          Les prestations totalisent {euros(total)}, le tarif du dossier dit {euros(tarif)} — cliquer pour aligner le tarif.
        </button>
      )}

      {services.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          Rien de coché. Le catalogue sert à compter ce qui se vend, pas à décrire.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2 mb-3">
          {services.map((s) => (
            <li
              key={s.id}
              className="group flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-lg border border-violet-500/40 bg-violet-500/10 text-xs text-[var(--color-text-primary)]"
            >
              <span>{s.label}</span>
              <span className="font-mono-num text-[var(--color-text-muted)]">
                {s.montant_ht === null ? "sur devis" : euros(s.montant_ht)}
                {serviceByCode(s.code)?.mensuel ? " /mois" : ""}
              </span>
              <button
                onClick={() => void retirer(s)}
                disabled={busy === s.code}
                aria-label={`Retirer ${s.label}`}
                className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-rose-500 transition-colors motion-reduce:transition-none"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => setOuvert((o) => !o)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-violet-500/50 hover:text-violet-500 transition-colors motion-reduce:transition-none"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter une prestation
        </button>
        {ajout && <span className="text-[11px] text-emerald-500">{ajout}</span>}
      </div>

      {ouvert && (
        <div className="mt-3 grid gap-3">
          {SERVICE_GROUPES.map((groupe) => (
            <div key={groupe}>
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">{groupe}</div>
              <div className="flex flex-wrap gap-1.5">
                {SERVICES.filter((s) => s.groupe === groupe).map((def) => {
                  const dedans = pris.has(def.code);
                  return (
                    <button
                      key={def.code}
                      onClick={() => void (dedans ? retirer(pris.get(def.code)!) : ajouter(def.code))}
                      disabled={busy === def.code}
                      className={`px-2 py-1 text-xs rounded-md border transition-colors motion-reduce:transition-none disabled:opacity-50 ${
                        dedans
                          ? "border-violet-500/60 bg-violet-500/10 text-violet-500"
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-violet-500/50"
                      }`}
                    >
                      {def.label}
                      {def.montant !== null && (
                        <span className="ml-1.5 font-mono-num text-[var(--color-text-muted)]">{def.montant} €</span>
                      )}
                      {def.mensuel && <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">/mois</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <form onSubmit={ajouterCustom} className="grid gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Prestation personnalisée"
              aria-label="Nom de la prestation personnalisée"
              className={INPUT}
            />
            <input
              value={customMontant}
              onChange={(e) => setCustomMontant(e.target.value)}
              placeholder="Montant HT"
              aria-label="Montant HT de la prestation personnalisée"
              inputMode="decimal"
              className={INPUT}
            />
            <button
              type="submit"
              disabled={!customLabel.trim() || busy === "custom"}
              className="px-3 py-2 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition-colors motion-reduce:transition-none"
            >
              Ajouter
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

/* ── Checklist ───────────────────────────────────────────────────────────── */

function Checklist({
  clientId, tasks, setTasks, prog, onError,
}: {
  clientId: string;
  tasks: Task[];
  setTasks: (t: Task[]) => void;
  prog: { done: number; total: number; pct: number };
  onError: (m: string) => void;
}) {
  const [ajout, setAjout] = useState("");
  const [mode, setMode] = useState<"none" | "paste" | "template">("none");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);

  async function envoyer(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch(`/api/crm/${clientId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { onError(messageErreur(j, r.status)); return false; }
      setTasks(j.tasks);
      onError("");
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function modifier(taskId: string, champ: Record<string, unknown>) {
    const r = await fetch(`/api/crm/${clientId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, ...champ }),
    });
    const j = await r.json();
    if (!r.ok) { onError(messageErreur(j, r.status)); return; }
    setTasks(j.tasks);
  }

  async function retirer(taskId: string) {
    const r = await fetch(`/api/crm/${clientId}/tasks?task=${taskId}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) { onError(messageErreur(j, r.status)); return; }
    setTasks(j.tasks);
  }

  // Regroupement par phase, dans l'ordre des rangs — les étapes sans phase
  // tombent dans un groupe muet plutôt que dans un faux « Divers ».
  const groupes = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of [...tasks].sort((a, b) => a.rank - b.rank)) {
      const k = t.phase ?? "";
      const g = m.get(k);
      if (g) g.push(t);
      else m.set(k, [t]);
    }
    return [...m.entries()];
  }, [tasks]);

  return (
    <Bloc
      titre="Checklist de mission"
      action={
        <span className="font-mono-num text-xs text-[var(--color-text-muted)]">
          {prog.done}/{prog.total} · {prog.pct}%
        </span>
      }
    >
      <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all ${prog.pct === 100 && prog.total > 0 ? "bg-emerald-500" : "bg-violet-500"}`}
          style={{ width: `${prog.pct}%` }}
        />
      </div>

      {tasks.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Rien à faire pour l&apos;instant. Applique un modèle de mission, ou colle la checklist que tu as préparée.
        </p>
      )}

      <div className="flex flex-col gap-4 mb-4">
        {groupes.map(([phase, list]) => (
          <div key={phase || "_"}>
            {phase && (
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">{phase}</div>
            )}
            <ul className="flex flex-col">
              {list.map((t) => (
                <li key={t.id} className="group flex items-start gap-2.5 py-1.5 border-b border-[var(--color-border)] last:border-0">
                  <button
                    onClick={() => void modifier(t.id, { done: !t.done })}
                    className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition ${
                      t.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--color-border-strong)] hover:border-violet-500"
                    }`}
                    title={t.done ? "Décocher" : "Cocher"}
                  >
                    {t.done && <Check className="w-3 h-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.done ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"}`}>
                      {t.label}
                    </div>
                    {t.details && <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{t.details}</div>}
                    {t.done_at && <div className="text-[11px] text-emerald-600/80 mt-0.5">fait le {dateFr(t.done_at)}</div>}
                  </div>
                  <button
                    onClick={() => void retirer(t.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-rose-500 transition"
                    title="Retirer cette étape"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Ajout d'une étape */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ajout.trim()) return;
          if (await envoyer({ label: ajout })) setAjout("");
        }}
        className="flex gap-2"
      >
        <input
          value={ajout}
          onChange={(e) => setAjout(e.target.value)}
          placeholder="Ajouter une étape…"
          className={INPUT}
        />
        <button type="submit" disabled={busy} className="px-3 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition shrink-0">
          <Plus className="w-4 h-4" />
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => setMode(mode === "template" ? "none" : "template")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-violet-500/50 transition"
        >
          <Sparkles className="w-3.5 h-3.5" /> Modèle de mission
        </button>
        <button
          onClick={() => setMode(mode === "paste" ? "none" : "paste")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-violet-500/50 transition"
        >
          <ClipboardPaste className="w-3.5 h-3.5" /> Coller une liste
        </button>
      </div>

      {mode === "template" && (
        <div className="mt-3 flex flex-col gap-2">
          {MISSION_TEMPLATES.map((t) => (
            <button
              key={t.id}
              disabled={busy}
              onClick={async () => { if (await envoyer({ template: t.id })) setMode("none"); }}
              className="text-left px-3 py-2 rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 transition disabled:opacity-50"
            >
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <ListChecks className="w-3.5 h-3.5 text-violet-500" />
                {t.nom}
                <span className="ml-auto text-[11px] text-[var(--color-text-muted)]">{t.steps.length} étapes</span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{t.resume}</div>
            </button>
          ))}
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Les étapes s&apos;ajoutent à la suite — appliquer un deuxième modèle n&apos;efface jamais ce qui est coché.
          </p>
        </div>
      )}

      {mode === "paste" && (
        <div className="mt-3">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={6}
            placeholder={"Colle ta checklist, une étape par ligne.\nLes puces, numéros et cases à cocher sont nettoyés tout seuls."}
            className={INPUT}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => { setMode("none"); setPaste(""); }} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)]">
              Annuler
            </button>
            <button
              disabled={busy || !paste.trim()}
              onClick={async () => { if (await envoyer({ paste })) { setPaste(""); setMode("none"); } }}
              className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition"
            >
              Ajouter les étapes
            </button>
          </div>
        </div>
      )}
    </Bloc>
  );
}

/* ── Journal ─────────────────────────────────────────────────────────────── */

function Journal({
  clientId, notes, setNotes, onError,
}: {
  clientId: string;
  notes: Note[];
  setNotes: (n: Note[]) => void;
  onError: (m: string) => void;
}) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<string>("note");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/crm/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, kind, ...(at ? { at } : {}) }),
      });
      const j = await r.json();
      if (!r.ok) { onError(messageErreur(j, r.status)); return; }
      setNotes(j.notes);
      setBody("");
      setAt("");
      onError("");
    } finally {
      setBusy(false);
    }
  }

  async function retirer(noteId: string) {
    const r = await fetch(`/api/crm/${clientId}/notes?note=${noteId}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) { onError(messageErreur(j, r.status)); return; }
    setNotes(j.notes);
  }

  return (
    <Bloc titre="Journal">
      <form onSubmit={ajouter} className="mb-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Ce qui s'est dit, ce qui a été décidé…"
          className={INPUT}
        />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${INPUT} !w-auto`}>
            {NOTE_KINDS.map((k) => <option key={k} value={k}>{NOTE_KIND_LABEL[k]}</option>)}
          </select>
          {/* La date de l'ÉVÉNEMENT : un appel du mardi noté le jeudi appartient au mardi. */}
          <input type="date" value={at} onChange={(e) => setAt(e.target.value)} className={`${INPUT} !w-auto`} title="Quand ça s'est passé (aujourd'hui par défaut)" />
          <button type="submit" disabled={busy || !body.trim()} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />} Consigner
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Rien de consigné pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col">
          {notes.map((n) => (
            <li key={n.id} className="group flex items-start gap-3 py-2 border-b border-[var(--color-border)] last:border-0">
              <div className="shrink-0 w-20 text-[11px] text-[var(--color-text-muted)] pt-0.5">
                <div className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{dateFr(n.at)}</div>
                {/* Un genre inconnu (venu d'une version ultérieure) s'affiche brut
                    plutôt que vide : le journal reste lisible en toutes circonstances. */}
                <div className="mt-0.5 text-violet-500">{NOTE_KIND_LABEL[n.kind as NoteKind] ?? n.kind}</div>
              </div>
              <div className="flex-1 min-w-0 text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">{n.body}</div>
              <button
                onClick={() => void retirer(n.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-rose-500 transition"
                title="Retirer cette entrée"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Bloc>
  );
}
