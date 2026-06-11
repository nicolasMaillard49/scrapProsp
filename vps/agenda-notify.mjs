#!/usr/bin/env node
/**
 * Rappels Telegram des RDV Google Calendar — version VPS, autonome.
 *
 *  - Rappel ~1 h avant chaque RDV (événements démarrant dans 0..60 min
 *    à la prochaine exécution, dédoublonnés via l'état persisté).
 *  - Résumé du matin (premier run après 7h, heure de Paris) : les RDV du jour.
 *
 * Cron (toutes les 10 min en journée) :
 *   *\/10 6-22 * * * cd /home/deploy/scrapProsp/vps && set -a && . ./radar.env && set +a && flock -n /tmp/agenda-notify.lock node agenda-notify.mjs >> /home/deploy/agenda-notify.log 2>&1
 *
 * Env requis (radar.env) : GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY,
 * GOOGLE_CALENDAR_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
 */

import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SA_EMAIL = process.env.GOOGLE_SA_EMAIL || "";
const SA_KEY = (process.env.GOOGLE_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "";
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || "";

const TZ = "Europe/Paris";
const REMINDER_WINDOW_MIN = 60;
const STATE_FILE = fileURLToPath(new URL("./agenda-notify.state.json", import.meta.url));

const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ── Token d'accès Google (JWT bearer, compte de service) ── */
async function accessToken() {
  const iat = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(SA_KEY).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token: ${res.status} ${await res.text().catch(() => "")}`);
  return (await res.json()).access_token;
}

async function listEvents(token, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Calendar list: ${res.status} ${await res.text().catch(() => "")}`);
  const json = await res.json();
  // Ignore les événements "journée entière" (pas de dateTime) : pas de rappel horaire.
  return (json.items ?? []).filter((e) => e.start?.dateTime);
}

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram: ${res.status} ${await res.text().catch(() => "")}`);
}

/* ── Helpers heure de Paris ── */
function parisHour(d = new Date()) {
  // en-GB : "17" — fr-FR renverrait "17 h" et Number() donnerait NaN.
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hour12: false }).format(d));
}
function parisDay(d = new Date()) {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function fmtTime(iso) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { reminded: [], lastDigest: "" };
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { reminded: [], lastDigest: "" };
  }
}

async function main() {
  const missing = ["GOOGLE_SA_EMAIL", "GOOGLE_SA_PRIVATE_KEY", "GOOGLE_CALENDAR_ID", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]
    .filter((k) => !process.env[k]);
  if (missing.length) {
    log("Config manquante:", missing.join(", "), "— rien à faire.");
    return;
  }

  const state = loadState();
  const now = new Date();
  const token = await accessToken();
  const today = parisDay(now);
  const digestPending = parisHour(now) >= 7 && state.lastDigest !== today;

  // Un seul appel Google : la fenêtre rappels (1 h) est incluse dans la fenêtre digest (24 h).
  const windowEnd = new Date(now.getTime() + (digestPending ? 24 * 3600 * 1000 : REMINDER_WINDOW_MIN * 60_000));
  const upcoming = await listEvents(token, now, windowEnd);

  try {
    /* ── Résumé du matin (premier run après 7h) ── */
    if (digestPending) {
      const todayEvents = upcoming.filter((e) => parisDay(new Date(e.start.dateTime)) === today);
      if (todayEvents.length > 0) {
        const lines = todayEvents.map((e) => `• <b>${fmtTime(e.start.dateTime)}</b> — ${esc(e.summary ?? "(sans titre)")}${e.location ? ` (${esc(e.location)})` : ""}`);
        await sendTelegram(`📅 <b>Aujourd'hui : ${todayEvents.length} RDV</b>\n${lines.join("\n")}`);
        log(`Résumé du matin envoyé (${todayEvents.length} RDV).`);
      }
      state.lastDigest = today;
    }

    /* ── Rappels ~1 h avant ── */
    const horizon = now.getTime() + REMINDER_WINDOW_MIN * 60_000;
    for (const e of upcoming) {
      const start = new Date(e.start.dateTime);
      // timeMin de l'API filtre sur l'heure de FIN : les RDV déjà commencés reviennent — pas de rappel.
      if (start <= now || start.getTime() > horizon) continue;
      const key = `${e.id}@${e.start.dateTime}`;
      if (state.reminded.includes(key)) continue;
      const minutes = Math.max(1, Math.round((start - now) / 60_000));
      const details = [
        e.location ? `📍 ${esc(e.location)}` : "",
        e.description ? esc(e.description.split("\n")[0].slice(0, 120)) : "",
      ].filter(Boolean).join("\n");
      try {
        await sendTelegram(
          `🔔 <b>RDV dans ${minutes} min</b> — ${fmtTime(e.start.dateTime)}\n<b>${esc(e.summary ?? "(sans titre)")}</b>${details ? `\n${details}` : ""}`,
        );
        state.reminded.push(key);
        log(`Rappel envoyé : ${e.summary} à ${fmtTime(e.start.dateTime)}.`);
      } catch (err) {
        // Échec d'UN envoi : on n'enregistre pas la clé (retenté au prochain run) sans bloquer les suivants.
        log(`ERREUR rappel ${e.summary}:`, err instanceof Error ? err.message : String(err));
      }
    }
  } finally {
    // Persiste toujours ce qui a été réellement envoyé — sinon doublons au prochain run.
    state.reminded = state.reminded.slice(-200);
    writeFileSync(STATE_FILE, JSON.stringify(state), "utf-8");
  }
}

main().catch((e) => { log("FATAL:", e instanceof Error ? e.stack : String(e)); process.exit(1); });
