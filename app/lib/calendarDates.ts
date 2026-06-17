/** Helpers de dates purs pour l'agenda (lundi = premier jour). */
export type CalendarView = "week" | "month" | "list";

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (out.getDay() + 6) % 7; // lundi = 0
  out.setDate(out.getDate() - day);
  return out;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** 42 jours (6 semaines) couvrant le mois de `d`, commençant un lundi. */
export function monthGrid(d: Date): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Plage [from, to) à charger pour une vue donnée, ancrée sur `ref`. */
export function rangeForView(view: CalendarView, ref: Date): { from: Date; to: Date } {
  if (view === "week") {
    const from = startOfWeek(ref);
    return { from, to: addDays(from, 7) };
  }
  if (view === "month") {
    const grid = monthGrid(ref);
    return { from: grid[0], to: addDays(grid[41], 1) };
  }
  // list : 60 jours glissants à partir d'aujourd'hui (ref ignoré pour rester "à venir")
  const from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return { from, to: addDays(from, 60) };
}
