/**
 * Google Calendar via compte de service (server-only).
 *
 * Setup (une fois, voir docs/google-calendar-setup.md) :
 *  1. Compte de service GCP + API Calendar activée
 *  2. Partager son agenda Google avec l'email du compte de service
 *     (« Apporter des modifications aux événements »)
 *  3. Env : GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY, GOOGLE_CALENDAR_ID
 *
 * Pas de dépendance : le flux JWT bearer est signé avec node:crypto.
 */
import crypto from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";
const API = "https://www.googleapis.com/calendar/v3";
export const TIMEZONE = "Europe/Paris";

export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO datetime, ou date seule (YYYY-MM-DD) si allDay. */
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  htmlLink: string | null;
  /** Id du prospect lié (stocké en extendedProperties quand le RDV est créé depuis une fiche). */
  prospectId: string | null;
}

export function calendarConfigured(): boolean {
  return !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY && process.env.GOOGLE_CALENDAR_ID);
}

function calendarId(): string {
  return encodeURIComponent(process.env.GOOGLE_CALENDAR_ID ?? "");
}

/* ── Token d'accès (JWT bearer), caché ~1 h ── */
let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const email = process.env.GOOGLE_SA_EMAIL!;
  // La clé privée arrive souvent avec des \n littéraux et parfois des guillemets
  // collés autour (copier-coller dans le dashboard Vercel).
  const key = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  const iat = Math.floor(Date.now() / 1000);

  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 })}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token: ${res.status} ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in - 60) * 1000 };
  return cached.token;
}

async function gcal(path: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken();
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toEvent(item: any): CalendarEvent {
  const allDay = !!item.start?.date;
  return {
    id: item.id,
    title: item.summary ?? "(sans titre)",
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    allDay,
    location: item.location ?? null,
    description: item.description ?? null,
    htmlLink: item.htmlLink ?? null,
    prospectId: item.extendedProperties?.private?.prospectId ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listEvents(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await gcal(`/calendars/${calendarId()}/events?${params}`);
  if (!res.ok) throw new Error(`Calendar list: ${res.status} ${await res.text().catch(() => "")}`);
  const json = await res.json();
  return (json.items ?? []).map(toEvent);
}

export async function createEvent(input: {
  title: string;
  start: string; // ISO datetime
  end: string;
  description?: string;
  location?: string;
  prospectId?: string;
}): Promise<CalendarEvent> {
  const res = await gcal(`/calendars/${calendarId()}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: input.title,
      description: input.description || undefined,
      location: input.location || undefined,
      start: { dateTime: input.start, timeZone: TIMEZONE },
      end: { dateTime: input.end, timeZone: TIMEZONE },
      extendedProperties: input.prospectId ? { private: { prospectId: input.prospectId } } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Calendar create: ${res.status} ${await res.text().catch(() => "")}`);
  return toEvent(await res.json());
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await gcal(`/calendars/${calendarId()}/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 410) throw new Error(`Calendar delete: ${res.status} ${await res.text().catch(() => "")}`);
}
