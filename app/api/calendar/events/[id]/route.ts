import { NextRequest, NextResponse } from "next/server";
import { calendarConfigured, deleteEvent } from "../../../../lib/googleCalendar";

export const dynamic = "force-dynamic";

/** DELETE /api/calendar/events/[id] — supprime un événement. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!calendarConfigured()) {
    return NextResponse.json({ configured: false }, { status: 501 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    await deleteEvent(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("calendar DELETE:", e);
    return NextResponse.json({ error: "Suppression impossible côté Google Calendar" }, { status: 502 });
  }
}
