// app/lib/igKpiWindow.ts
// Borne basse de la fenêtre KPI — logique PURE.
//
// Les agrégats sont indexés par JOUR CIVIL Europe/Paris. Une borne « maintenant
// moins N×24 h » est donc fausse par construction : elle coupe le jour le plus
// ancien en son milieu, et ce jour-là ressort amputé. L'Apps Script du Sheet de
// tracking, qui se resynchronise toutes les 5 minutes sur `days=3`, réécrivait
// ce jour tronqué à chaque passage — d'où un 31/07 à 49 messages « 19h-20h »
// alors que la journée en comptait 50, de 12h à 20h.

const DAY_MS = 24 * 3600_000;

/** Décalage d'Europe/Paris (en minutes) à un instant donné. Suit l'heure d'été. */
function parisOffsetMinutes(at: Date): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
  }).format(at);
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(s);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * Instant ISO du DÉBUT du jour civil Paris situé `days - 1` jours avant `now`.
 *
 * `days = 1` → minuit du jour même ; `days = 3` → minuit de l'avant-avant-veille,
 * soit trois jours civils pleins, aujourd'hui compris. La borne ne dépend plus
 * de l'heure d'appel : deux exécutions le même jour rendent la même valeur.
 */
export function sinceParisDays(now: Date, days: number): string {
  const n = Math.max(1, Math.floor(days));
  const target = new Date(now.getTime() - (n - 1) * DAY_MS);
  const [y, m, d] = target
    .toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" })
    .split("-")
    .map(Number);

  // Midi UTC tombe dans le bon jour civil quelle que soit la saison : c'est un
  // point d'appui sûr pour lire l'offset qui s'applique CE jour-là.
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const offset = parisOffsetMinutes(noon);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset * 60_000).toISOString();
}
