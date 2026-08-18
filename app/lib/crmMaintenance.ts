import { echeanceDe, parseTarif } from "./crm";

export interface MaintenanceClient {
  id: string;
  nom: string;
  maintenance_ht: number | string | null;
  maintenance_day: number | null;
}

export interface MaintenanceDue extends MaintenanceClient {
  due_date: string;
  montant_ht: number;
}

function parisDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function maintenancesDues(rows: MaintenanceClient[], now: Date): MaintenanceDue[] {
  const today = parisDateKey(now);
  const periode = `${today.slice(0, 7)}-01`;
  return rows.flatMap((row) => {
    const montant = parseTarif(row.maintenance_ht);
    if (!montant || !row.maintenance_day) return [];
    const dueDate = echeanceDe(periode, row.maintenance_day);
    return dueDate === today ? [{ ...row, due_date: dueDate, montant_ht: montant }] : [];
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char]!);
}

export function maintenanceReminderEmail(rows: MaintenanceDue[]): { subject: string; html: string } {
  const n = rows.length;
  const total = rows.reduce((sum, row) => sum + row.montant_ht, 0);
  const subject = `${n} maintenance${n > 1 ? "s" : ""} à encaisser aujourd'hui`;
  const items = rows.map((row) =>
    `<li style="margin:8px 0"><strong>${escapeHtml(row.nom)}</strong> — ${row.montant_ht.toLocaleString("fr-FR")} € HT</li>`,
  ).join("");
  return {
    subject,
    html: `<div style="font-family:Arial,sans-serif;color:#18181b;line-height:1.5"><h1 style="font-size:20px">Échéances de maintenance</h1><p>À vérifier aujourd'hui dans le CRM :</p><ul>${items}</ul><p><strong>Total : ${total.toLocaleString("fr-FR")} € HT</strong></p></div>`,
  };
}
