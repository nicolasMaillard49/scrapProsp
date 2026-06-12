import { NextRequest, NextResponse } from "next/server";
import { calendarConfigured, listEvents, createEvent } from "../../../lib/googleCalendar";

export const dynamic = "force-dynamic";

/** GET /api/calendar/events?from=ISO&to=ISO — liste les événements de la plage. */
export async function GET(req: NextRequest) {
  if (!calendarConfigured()) {
    return NextResponse.json({ configured: false, events: [] }, { status: 501 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const timeMin = from ? new Date(from) : new Date();
  const timeMax = to ? new Date(to) : new Date(Date.now() + 14 * 24 * 3600 * 1000);
  if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime())) {
    return NextResponse.json({ error: "Plage de dates invalide" }, { status: 400 });
  }
  try {
    const events = await listEvents(timeMin, timeMax);
    return NextResponse.json({ configured: true, events });
  } catch (e) {
    console.error("calendar GET:", e);
    return NextResponse.json({ error: "Google Calendar inaccessible" }, { status: 502 });
  }
}

/** POST /api/calendar/events — crée un événement { title, start, end, description?, location?, prospectId? }. */
export async function POST(req: NextRequest) {
  if (!calendarConfigured()) {
    return NextResponse.json({ configured: false }, { status: 501 });
  }
  let body: { title?: string; start?: string; end?: string; description?: string; location?: string; prospectId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.start || !body.end) {
    return NextResponse.json({ error: "title, start et end sont requis" }, { status: 400 });
  }
  if (Number.isNaN(new Date(body.start).getTime()) || Number.isNaN(new Date(body.end).getTime())) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  }
  try {
    const event = await createEvent({
      title: body.title.trim(),
      start: body.start,
      end: body.end,
      description: body.description,
      location: body.location,
      prospectId: typeof body.prospectId === "string" && body.prospectId.trim() ? body.prospectId.trim() : undefined,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    console.error("calendar POST:", e);
    return NextResponse.json({ error: "Création impossible côté Google Calendar" }, { status: 502 });
  }
}
