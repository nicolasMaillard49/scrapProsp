/**
 * Normalise un numero FR pour WhatsApp (format international sans +).
 *  "06 12 34 56 78" -> "33612345678"
 *  "+33 5 55 12 34 56" -> "33555123456"
 */
export function phoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("33")) return digits;
  if (digits.startsWith("0")) return "33" + digits.slice(1);
  return digits;
}

export function whatsAppUrl(phone: string, text?: string): string {
  const num = phoneForWhatsApp(phone);
  const base = `https://wa.me/${num}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Message WhatsApp pré-rempli pour la prospection commerciale. */
export function salesWhatsAppMsg(name: string, metier: string, ville: string): string {
  return `Bonjour,

Je me permets de vous contacter concernant la visibilité en ligne de votre activité de ${metier} à ${ville}.

Après une analyse rapide de votre présence sur Google, j'ai identifié des opportunités intéressantes pour développer votre clientèle.

Seriez-vous disponible pour un échange de 5 minutes ? Je peux vous présenter un audit gratuit et sans engagement.

Bien cordialement`;
}

/**
 * Formate une date pour l'URL Google Calendar (heure locale, sans Z).
 * "2026-05-22T10:00" -> "20260522T100000"
 */
function fmtGCal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  details?: string;
  location?: string;
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${fmtGCal(ev.start)}/${fmtGCal(ev.end)}`,
  });
  if (ev.details) params.set("details", ev.details);
  if (ev.location) params.set("location", ev.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Date par defaut pour un RDV : demain a 10h00. */
export function defaultRdvDate(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
