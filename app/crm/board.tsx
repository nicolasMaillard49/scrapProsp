"use client";

// Le tableau des dossiers : une colonne par statut, une carte par client.
//
// Pourquoi un tableau et pas une grille : la question posée en ouvrant le CRM
// n'est pas « quels clients ai-je ? » mais « où en est chacun ? ». Un tableau
// répond à la seconde par sa GÉOMÉTRIE — la position de la carte EST l'état,
// aucune pastille à lire. C'est ce que font Pipedrive, HubSpot et Attio, et
// c'est ce qui rend le déplacement possible : faire avancer un dossier, c'est
// le déplacer, pas ouvrir une fiche pour y changer un menu déroulant.
//
// Toutes les colonnes sont rendues, même vides : on ne dépose pas dans une
// colonne qui n'existe pas.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { ExternalLink, Plus, GripVertical, CircleDot, Loader2 } from "lucide-react";
import {
  CLIENT_STATUS_LABEL, CLIENT_STATUS_HINT, clientTone, groupByStatus, sumTarif,
  relativeFr, isStale, type ClientStatus,
} from "@/app/lib/crm";
import { euros, type ClientRow, type Candidate } from "./types";
import { Avatar, IgIcon } from "./ui";

/** Teinte de colonne : un filet de couleur en tête, jamais un fond coloré. */
const RAIL: Record<string, string> = {
  todo: "bg-neutral-400",
  progress: "bg-violet-500",
  wait: "bg-amber-500",
  warm: "bg-sky-500",
  won: "bg-emerald-500",
  lost: "bg-rose-400",
};

export function Board({
  rows, candidates, onMove, onImport, importing,
}: {
  rows: ClientRow[];
  candidates: Candidate[];
  onMove: (id: string, statut: ClientStatus) => Promise<void>;
  onImport: (p: Candidate) => Promise<void>;
  importing: string | null;
}) {
  const [dragged, setDragged] = useState<ClientRow | null>(null);
  const colonnes = useMemo(() => groupByStatus(rows), [rows]);
  // « il y a 3 j » se calcule au rendu : figer l'instant au montage ferait
  // vieillir l'écran d'un jour sans jamais le dire, sur un outil qui reste
  // ouvert toute la journée.
  const now = new Date();

  // 6 px avant de saisir : sans cette contrainte, le clic qui ouvre la fiche
  // serait mangé par le glisser dès que la souris frémit.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function debut(e: DragStartEvent) {
    setDragged(rows.find((r) => r.id === e.active.id) ?? null);
  }

  async function fin(e: DragEndEvent) {
    const carte = dragged;
    setDragged(null);
    const cible = e.over?.id as ClientStatus | undefined;
    if (!carte || !cible || cible === carte.statut) return;
    await onMove(carte.id, cible);
  }

  return (
    <DndContext sensors={sensors} onDragStart={debut} onDragEnd={fin} onDragCancel={() => setDragged(null)}>
      {/* Six colonnes qui se partagent la largeur : pas de défilement horizontal.
          Une barre à pousser pour voir un client est une barre de trop — le
          tableau doit se lire d'un regard et se traverser en glissant. */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 items-stretch gap-3 min-h-[min(70vh,620px)]">
        {colonnes.map(({ statut, rows: cartes }) => (
          <Colonne
            key={statut}
            statut={statut}
            cartes={cartes}
            now={now}
            /* Les prospects bookés n'apparaissent QUE sous « Piste » : c'est là
               qu'ils entreraient, et les poser ailleurs suggérerait qu'on peut
               ouvrir un dossier directement à « Livré ». */
            candidates={statut === "piste" ? candidates : []}
            onImport={onImport}
            importing={importing}
            survole={dragged !== null && dragged.statut !== statut}
          />
        ))}
      </div>

      {/* La carte suit le curseur à l'identique : pendant le déplacement, on
          continue de voir DE QUI il s'agit, pas un rectangle gris. */}
      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {dragged ? <Carte c={dragged} now={now} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Colonne ─────────────────────────────────────────────────────────────── */

function Colonne({
  statut, cartes, candidates, onImport, importing, survole, now,
}: {
  statut: ClientStatus;
  cartes: ClientRow[];
  candidates: Candidate[];
  onImport: (p: Candidate) => Promise<void>;
  importing: string | null;
  survole: boolean;
  now: Date;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statut });
  const tone = clientTone(statut);
  const total = sumTarif(cartes);

  return (
    <section
      ref={setNodeRef}
      aria-label={CLIENT_STATUS_LABEL[statut]}
      className={`min-w-0 flex flex-col rounded-xl border transition-colors duration-200 motion-reduce:transition-none ${
        isOver
          ? "border-violet-500/70 bg-violet-500/[0.06]"
          : survole
            ? "border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-2)]"
            : "border-[var(--color-border)] bg-[var(--color-surface-2)]"
      }`}
    >
      <header className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${RAIL[tone]}`} />
          <h2 className="text-[13px] font-medium text-[var(--color-text-primary)]">{CLIENT_STATUS_LABEL[statut]}</h2>
          <span className="font-mono-num text-[11px] text-[var(--color-text-muted)]">{cartes.length}</span>
          {total > 0 && (
            <span className="ml-auto font-mono-num text-[11px] text-[var(--color-text-secondary)]">{euros(total)}</span>
          )}
        </div>
        <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-muted)]">{CLIENT_STATUS_HINT[statut]}</p>
      </header>

      <div className="p-2 pt-1 flex flex-col gap-2 flex-1">
        {candidates.map((p) => (
          <Reprise key={p.id} p={p} busy={importing === p.id} onImport={onImport} now={now} />
        ))}

        {cartes.map((c) => <Carte key={c.id} c={c} now={now} />)}

        {cartes.length === 0 && candidates.length === 0 && (
          <div
            className={`flex-1 rounded-lg border border-dashed flex items-center justify-center text-[11px] transition-colors duration-200 motion-reduce:transition-none ${
              isOver
                ? "border-violet-500/60 text-violet-500"
                : "border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {isOver ? "Déposer ici" : survole ? "Déposer ici" : "Vide"}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Carte dossier ───────────────────────────────────────────────────────── */

function Carte({ c, now, overlay = false }: { c: ClientRow; now: Date; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: c.id, disabled: overlay });
  const dort = isStale(c.statut, c.last_activity, now);

  return (
    <article
      ref={setNodeRef}
      className={`group relative rounded-lg border bg-[var(--color-surface-solid)] overflow-hidden transition-[border-color,box-shadow,opacity] duration-200 motion-reduce:transition-none ${
        overlay
          ? "border-violet-500/60 shadow-xl shadow-black/20 rotate-[1.5deg] w-[274px]"
          : isDragging
            ? "opacity-30 border-[var(--color-border)]"
            : "border-[var(--color-border)] hover:border-violet-500/50"
      }`}
    >
      {/* La poignée est un bouton dédié : la carte entière serait un piège, on
          cliquerait pour ouvrir et on déplacerait sans le vouloir. */}
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        aria-label={`Déplacer ${c.nom}`}
        className="absolute top-1.5 right-1.5 z-10 p-1 rounded-md text-[var(--color-text-muted)] bg-[var(--color-surface-solid)]/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-violet-500 cursor-grab active:cursor-grabbing transition-opacity motion-reduce:transition-none"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <Link href={`/crm/${c.id}`} className="block">
        <Vignette url={c.image_url} nom={c.nom} />

        <div className="p-3 flex flex-col gap-2.5">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate group-hover:text-violet-500 transition-colors motion-reduce:transition-none">
              {c.nom}
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate">
              {[c.metier, c.ville].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>

          {c.next_action ? (
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-text-secondary)]">
              <CircleDot className="w-3 h-3 mt-[1px] shrink-0 text-violet-500" />
              <span className="line-clamp-2">{c.next_action}</span>
            </p>
          ) : (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {c.progress.total === 0 ? "Aucune étape — coller la checklist" : "Toutes les étapes sont faites"}
            </p>
          )}

          <div>
            <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
              <span className="font-mono-num">{c.progress.done}/{c.progress.total}</span>
              <span className="font-mono-num">{c.progress.pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${
                  c.progress.pct === 100 ? "bg-emerald-500" : "bg-violet-500"
                }`}
                style={{ width: `${c.progress.pct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {/* Le forfait et le mensuel se lisent côte à côte, jamais l'un
                déguisé en l'autre : « 300 € /mois » sur un site vendu 300 €
                une fois est un prix faux affiché tous les jours. */}
            <span className="font-mono-num text-[var(--color-text-secondary)]">
              {euros(c.tarif_ht)}
              {c.maintenance_ht ? (
                <span className="text-[var(--color-text-muted)]"> + {euros(c.maintenance_ht)}/mois</span>
              ) : null}
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-[var(--color-text-muted)]">
              {c.instagram_prospect_id && <IgIcon className="w-3 h-3" />}
              {c.site_url && <ExternalLink className="w-3 h-3" />}
            </span>
          </div>

          {/* Le silence est une information : un dossier actif sans geste depuis
              dix jours est celui qu'on a oublié, et c'est exactement celui qu'un
              tableau doit désigner. */}
          <p className={`text-[10px] ${dort ? "text-amber-500" : "text-[var(--color-text-muted)]"}`}>
            {dort ? "sans activité " : "activité "}{relativeFr(c.last_activity, now)}
          </p>
        </div>
      </Link>
    </article>
  );
}

/**
 * L'image du client, en bandeau.
 *
 * Une vignette large et non un rond de 44 px : avec une dizaine de dossiers,
 * c'est la PHOTO qu'on reconnaît avant le nom. Sans image, un aplat sobre et
 * l'initiale — jamais une icône cassée ni un trou dans la colonne.
 */
function Vignette({ url, nom }: { url: string | null; nom: string }) {
  const [ko, setKo] = useState(false);
  useEffect(() => setKo(false), [url]);

  return (
    <div className="h-32 bg-[var(--color-surface-2)] border-b border-[var(--color-border)] flex items-center justify-center overflow-hidden">
      {url && !ko ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setKo(true)} className="w-full h-full object-cover" />
      ) : (
        <Avatar url={null} nom={nom} size={44} />
      )}
    </div>
  );
}

/* ── Prospect booké, à reprendre ─────────────────────────────────────────── */

/**
 * Le prospect Instagram booké s'affiche EN TÊTE de la colonne « Piste », en
 * pointillés : il n'est pas encore un dossier, mais c'est là qu'il entrera.
 * Le sortir dans une section à part, en bas de page, revenait à le cacher.
 */
function Reprise({
  p, busy, onImport, now,
}: {
  p: Candidate;
  busy: boolean;
  onImport: (p: Candidate) => Promise<void>;
  now: Date;
}) {
  return (
    <article className="rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-solid)] overflow-hidden">
      <Vignette url={p.profile_pic_url ?? null} nom={p.full_name || p.username} />
      <div className="p-3 flex flex-col gap-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {p.full_name || `@${p.username}`}
          </h3>
          <p className="text-[11px] text-[var(--color-text-muted)] truncate">
            {[p.metier, p.ville].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-violet-500">
          <IgIcon className="w-3 h-3 shrink-0" /> Call booké — pas encore de dossier
        </p>

        <button
          onClick={() => void onImport(p)}
          disabled={busy}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md border border-violet-500/40 text-violet-500 hover:bg-violet-500/10 transition-colors motion-reduce:transition-none disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Ouvrir le dossier
        </button>

        <p className="text-[10px] text-[var(--color-text-muted)]">
          prospect · {relativeFr(p.last_dm_at ?? null, now)}
        </p>
      </div>
    </article>
  );
}
