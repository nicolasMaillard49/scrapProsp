"use client";

// La supervision : ce qui vit APRÈS la livraison.
//
// Un dossier livré n'est pas un dossier fini — le site tourne, la campagne
// tourne, et le client paie tous les mois. Ce revenu-là ne se voit dans aucun
// pipeline de mission (qui, lui, se termine), et l'oublier revient à travailler
// gratuitement sans s'en apercevoir.
//
// La question à laquelle cet écran répond, et qu'aucune mémoire ne tranche :
// « m'a-t-il réglé ce mois-ci ? ». Trois réponses possibles, jamais confondues :
// payé, échéance émise en attente, échéance PAS ENCORE ÉMISE — un mois sans
// ligne n'est pas un impayé, c'est une facture qui reste à faire.

import { useState } from "react";
import Link from "next/link";
import { Check, Plus, Undo2, Loader2, AlertTriangle } from "lucide-react";
import {
  enSupervision, mrr, supervisionSummary, prochainePeriode, etatFacture, moisFr, moisDe,
  moisPrecedents, echeanceDe, messageErreur, ETAT_FACTURE_LABEL, type EtatFacture,
} from "@/app/lib/crm";
import { euros, dateFr, type ClientRow } from "./types";
import { Avatar } from "./ui";

const ETAT_CLASS: Record<EtatFacture, string> = {
  payee: "text-emerald-500",
  a_echoir: "text-[var(--color-text-secondary)]",
  en_retard: "text-rose-500",
};

export function Supervision({ rows, onChange }: { rows: ClientRow[]; onChange: () => Promise<void> }) {
  const supervises = rows.filter(enSupervision);
  // Marqué « récurrent » mais sans montant : le dossier ne peut pas être suivi,
  // et se taire le ferait disparaître sans que personne comprenne pourquoi.
  const incomplets = rows.filter((c) => c.recurrent && !enSupervision(c));
  if (supervises.length === 0 && incomplets.length === 0) return null;

  const now = new Date();
  const recurrent = mrr(supervises);
  const bilans = supervises.map((c) => ({ c, s: supervisionSummary(c.invoices ?? [], now) }));
  const duHT = bilans.reduce((n, b) => n + b.s.duHT, 0);
  const enRetard = bilans.filter((b) => b.s.retards.length > 0).length;
  const aEmettre = bilans.filter((b) => prochainePeriode(b.c.invoices ?? [], now) !== null).length;

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Terminé, mais sous supervision</h2>
        <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">
          La mission est livrée, la maintenance court. Ce tableau dit qui a payé {moisFr(moisDe(now))}.
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-base">
          <span className="font-mono-num text-[var(--color-text-secondary)]">
            {euros(recurrent)} <span className="text-[var(--color-text-muted)]">/mois</span>
          </span>
          {duHT > 0 && (
            <span className="font-mono-num text-rose-500">
              {euros(duHT)} <span className="opacity-80">en retard</span>
            </span>
          )}
          {aEmettre > 0 && (
            <span className="text-[var(--color-text-muted)]">{aEmettre} à facturer</span>
          )}
        </div>
      </header>

      {enRetard > 0 && (
        <p className="flex items-center gap-2 mb-4 px-4 py-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-base text-rose-500">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {enRetard === 1 ? "Un dossier a une échéance dépassée" : `${enRetard} dossiers ont une échéance dépassée`} — à relancer.
        </p>
      )}

      {incomplets.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-base leading-relaxed text-amber-700 dark:text-amber-400">
          <p className="mb-2">
            Maintenance activée sans montant mensuel — impossible de suivre les paiements tant qu'il est vide.
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            {incomplets.map((c) => (
              <Link key={c.id} href={`/crm/${c.id}`} className="underline underline-offset-2 hover:no-underline">
                {c.nom} — renseigner le montant
              </Link>
            ))}
          </p>
        </div>
      )}

      {bilans.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
          {bilans.map(({ c, s }) => (
            <LigneSupervision key={c.id} c={c} s={s} now={now} onChange={onChange} />
          ))}
        </div>
      )}
    </section>
  );
}

function LigneSupervision({
  c, s, now, onChange,
}: {
  c: ClientRow;
  s: ReturnType<typeof supervisionSummary>;
  now: Date;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const aEmettre = prochainePeriode(c.invoices ?? [], now);

  async function appel(init: RequestInit) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/crm/${c.id}/invoices`, init);
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setErr(messageErreur(j, r.status));
        return;
      }
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  const emettre = () =>
    appel({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periode: aEmettre }),
    });

  /**
   * Un mois passé déjà réglé : on l'émet ET on l'encaisse d'un seul geste.
   *
   * L'encaissement est daté à L'ÉCHÉANCE de ce mois-là, pas au jour de la
   * saisie : rattraper juillet le 9 août en le datant du 9 août ferait mentir
   * l'historique, et c'est cet historique qui dit si un client paie en retard.
   */
  const rattraper = (periode: string) =>
    appel({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periode, paid: true, paid_at: echeanceDe(periode, c.maintenance_day) }),
    });

  const basculer = (invoiceId: string, paid: boolean) =>
    appel({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_id: invoiceId, paid }),
    });

  // La frise couvre les six derniers mois, FACTURÉS OU NON : un mois sans
  // ligne est précisément celui qu'on a oublié d'émettre, et ne pas l'afficher
  // le rendrait invisible. Un clic dessus rattrape un mois déjà réglé.
  const parPeriode = new Map((c.invoices ?? []).map((f) => [String(f.periode).slice(0, 10), f]));
  const frise = moisPrecedents(now, 6).map((m) => ({ mois: m, f: parPeriode.get(m) ?? null }));

  return (
    <div className="p-4 sm:p-5 flex flex-wrap items-center gap-x-6 gap-y-4">
      <Link href={`/crm/${c.id}`} className="group flex items-center gap-3.5 min-w-0 w-64 shrink-0">
        <Avatar url={c.image_url} nom={c.nom} size={48} />
        <span className="min-w-0">
          <span className="block text-base font-semibold text-[var(--color-text-primary)] truncate group-hover:text-violet-500 transition-colors motion-reduce:transition-none">
            {c.nom}
          </span>
          <span className="block mt-0.5 text-sm text-[var(--color-text-secondary)] truncate">
            {euros(c.maintenance_ht)} /mois · le {c.maintenance_day ?? 30}
          </span>
        </span>
      </Link>

      {/* La frise des mois : l'historique de paiement en un coup d'œil. */}
      <div className="flex flex-wrap items-center gap-2">
        {frise.map(({ mois, f }) => {
          const etat = f ? etatFacture(f, now) : null;
          const titre = f
            ? `${moisFr(mois)} · ${ETAT_FACTURE_LABEL[etat!]}${f.due_date ? ` · échéance ${dateFr(f.due_date)}` : ""}${f.paid_at ? ` · encaissé le ${dateFr(f.paid_at)}` : ""} — cliquer pour ${f.paid_at ? "annuler l'encaissement" : "marquer payé"}`
            : `${moisFr(mois)} · pas de facture — cliquer pour l'enregistrer comme réglée le ${dateFr(echeanceDe(mois, c.maintenance_day))}`;
          return (
            <button
              key={mois}
              onClick={() => void (f ? basculer(f.id, !f.paid_at) : rattraper(mois))}
              disabled={busy}
              title={titre}
              className={`min-h-10 px-3 py-2 rounded-md border text-sm font-medium font-mono-num transition-colors motion-reduce:transition-none disabled:opacity-50 ${
                etat === "payee"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : etat === "en_retard"
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
                    : etat === "a_echoir"
                      ? "border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:border-violet-500/50"
                      : "border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-violet-500/50 hover:text-violet-500"
              }`}
            >
              {mois.slice(5, 7)}/{mois.slice(2, 4)}
            </button>
          );
        })}
      </div>

      <div className="text-sm leading-relaxed min-w-48">
        <span className={ETAT_CLASS[s.courante ? etatFacture(s.courante, now) : "a_echoir"]}>
          {s.courante
            ? `${moisFr(s.courante.periode)} · ${ETAT_FACTURE_LABEL[etatFacture(s.courante, now)]}`
            : "Mois en cours non facturé"}
        </span>
        <span className="block text-[var(--color-text-muted)]">
          {s.dernierPaiement ? `dernier encaissement : ${moisFr(s.dernierPaiement)}` : "aucun encaissement"}
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        {err && <span className="text-sm text-rose-500">{err}</span>}

        {s.courante && !s.courante.paid_at && (
          <button
            onClick={() => void basculer(s.courante!.id, true)}
            disabled={busy}
            className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-500 transition-colors motion-reduce:transition-none disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Marquer payé
          </button>
        )}

        {s.courante?.paid_at && (
          <button
            onClick={() => void basculer(s.courante!.id, false)}
            disabled={busy}
            title="Annuler l'encaissement"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors motion-reduce:transition-none disabled:opacity-50"
          >
            <Undo2 className="w-4 h-4" />
          </button>
        )}

        {aEmettre && (
          <button
            onClick={() => void emettre()}
            disabled={busy}
            className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md border border-violet-500/40 text-violet-500 hover:bg-violet-500/10 transition-colors motion-reduce:transition-none disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Facturer {moisFr(aEmettre)}
          </button>
        )}
      </div>
    </div>
  );
}
