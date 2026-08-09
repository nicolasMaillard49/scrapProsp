// Les formes échangées entre les écrans CRM et `/api/crm/*`.
// Un seul fichier pour les deux pages : la liste et la fiche parlent du même
// dossier, les laisser diverger ferait mentir l'une des deux.

import type { Progress, Invoice, ClientService } from "@/app/lib/crm";

export type { Invoice, ClientService };

export interface Client {
  id: string;
  nom: string;
  contact: string | null;
  email: string | null;
  telephone: string | null;
  site_url: string | null;
  image_url: string | null;
  metier: string | null;
  ville: string | null;
  description: string;
  statut: string;
  source: string | null;
  /** Prix de la MISSION, une fois. */
  tarif_ht: number | string | null;
  /** Montant MENSUEL de supervision. Jamais additionné au précédent. */
  maintenance_ht: number | string | null;
  /** Jour du mois où la maintenance est due (1-31). */
  maintenance_day: number | null;
  recurrent: boolean;
  started_at: string | null;
  closed_at: string | null;
  instagram_prospect_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Un dossier tel que servi par le TABLEAU : avancement, prochaine étape et
 * dernier geste pré-calculés côté serveur.
 *
 * La carte doit répondre à « où en est-il ? » ET « qu'est-ce que j'ai à faire ? »
 * sans être ouverte — sinon le tableau n'est qu'un sommaire de plus.
 */
export interface ClientRow extends Client {
  progress: Progress;
  /** Libellé de la première étape non cochée, `null` si tout est fait ou vide. */
  next_action: string | null;
  /** Dernier geste consigné (étape cochée, note), pas la dernière écriture en base. */
  last_activity: string | null;
  /** Les échéances de maintenance, la plus récente d'abord. Vide hors supervision. */
  invoices: Invoice[];
  /** Les prestations vendues, dans l'ordre où elles l'ont été. */
  services: ClientService[];
}

export interface Task {
  id: string;
  client_id: string;
  label: string;
  details: string | null;
  phase: string | null;
  rank: number;
  done: boolean;
  done_at: string | null;
  due_date: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  client_id: string;
  body: string;
  kind: string;
  at: string;
  created_at: string;
}

/** Un prospect Instagram booké, proposé à la reprise en dossier. */
export interface Candidate {
  id: string;
  username: string;
  full_name: string | null;
  metier: string | null;
  ville: string | null;
  external_url: string | null;
  profile_pic_url?: string | null;
  /** Dernier DM envoyé — sert à dater le « call booké » sur la carte. */
  last_dm_at?: string | null;
}

/** Le prospect d'origine, tel que relu dans la fiche. */
export interface LinkedProspect extends Candidate {
  followers: number | null;
  stage: string | null;
  status: string | null;
  score: number | null;
}

/** Classes Tailwind par teinte de statut — une seule table, les deux écrans la lisent. */
export const TONE_CLASS: Record<string, string> = {
  todo: "bg-neutral-500/10 text-neutral-500 border-neutral-500/30",
  progress: "bg-violet-500/10 text-violet-500 border-violet-500/30",
  wait: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  warm: "bg-sky-500/10 text-sky-500 border-sky-500/30",
  won: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  lost: "bg-rose-500/10 text-rose-500 border-rose-500/30",
};

/** Montant en € HT, tel qu'on l'écrit en France. `—` quand rien n'est fixé. */
export function euros(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} € HT`;
}

/** Date courte française, ou `—`. */
export function dateFr(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}
