#!/usr/bin/env node
/**
 * Radar de nouveaux prospects — version VPS (boucle complete, sans limite de temps).
 *
 * Pourquoi ici et pas dans une fonction Vercel : le scrape parcourt ~27 combos
 * metier×region × ~13 villes = ~350 appels au scraper (~13 s chacun) => 25-75 min,
 * bien au-dela de la limite de 300 s des fonctions Vercel. Sur le VPS (ou tourne
 * deja le scraper), aucune limite : on scrape, on insere en base et on envoie le
 * SMS recap directement via les API REST (aucune dependance npm, juste Node >= 18).
 *
 * Lancer en cron (3h du matin) :
 *   0 3 * * * cd /chemin/vers/repo/vps && set -a && . ./radar.env && set +a && node radar.mjs >> /var/log/radar-cron.log 2>&1
 *
 * Variables d'environnement requises (voir radar.env.example) :
 *   SUPABASE_URL, SUPABASE_KEY (cle publishable, identique a l'app),
 *   + un canal de notif : TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID (recap riche, prefere)
 *     ou TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_MESSAGING_SERVICE_SID (fallback SMS)
 * Optionnelles :
 *   SCRAPER_URL (defaut http://localhost:8001), RADAR_ADMIN_PHONE (defaut 0615907873)
 */

// ── Villes scannees par region (copie de app/lib/regionCities.ts — garder en phase) ──
const REGION_CITIES = {
  "lorraine-rurale": ["Metz", "Nancy", "Thionville", "Epinal", "Bar-le-Duc", "Verdun", "Luneville", "Sarrebourg", "Sarreguemines", "Forbach", "Saint-Die-des-Vosges", "Pont-a-Mousson", "Toul", "Commercy"],
  "occitanie-rurale": ["Cahors", "Rodez", "Mende", "Auch", "Albi", "Montauban", "Tarbes", "Foix", "Millau", "Figeac", "Villefranche-de-Rouergue", "Castres", "Condom", "Decazeville"],
  "auvergne": ["Clermont-Ferrand", "Moulins", "Aurillac", "Le Puy-en-Velay", "Vichy", "Montlucon", "Riom", "Issoire", "Thiers", "Yssingeaux", "Brioude", "Ambert", "Saint-Flour"],
  "bourgogne": ["Dijon", "Auxerre", "Nevers", "Macon", "Chalon-sur-Saone", "Sens", "Beaune", "Autun", "Le Creusot", "Montceau-les-Mines", "Avallon", "Joigny", "Tonnerre"],
  "centre": ["Orleans", "Tours", "Bourges", "Chartres", "Blois", "Chateauroux", "Dreux", "Vierzon", "Montargis", "Vendome", "Chinon", "Amboise", "Romorantin-Lanthenay"],
  "champagne-rurale": ["Troyes", "Charleville-Mezieres", "Chaumont", "Sedan", "Saint-Dizier", "Langres", "Vitry-le-Francois", "Rethel", "Nogent-sur-Seine", "Romilly-sur-Seine", "Bar-sur-Aube"],
  "limousin": ["Limoges", "Brive-la-Gaillarde", "Tulle", "Gueret", "Ussel", "Saint-Junien", "Aubusson", "Bellac", "Saint-Yrieix-la-Perche", "Egletons"],
  "normandie-rurale": ["Caen", "Rouen", "Le Havre", "Alencon", "Evreux", "Lisieux", "Cherbourg", "Dieppe", "Fecamp", "Bayeux", "Argentan", "Flers", "Vire", "Coutances"],
  "poitou": ["Poitiers", "Niort", "La Rochelle", "Angouleme", "Saintes", "Cognac", "Rochefort", "Chatellerault", "Bressuire", "Parthenay", "Thouars", "Royan", "Jonzac"],
  "pyrenees-rurales": ["Pau", "Tarbes", "Bayonne", "Biarritz", "Oloron-Sainte-Marie", "Lourdes", "Orthez", "Lannemezan", "Bagneres-de-Bigorre", "Saint-Jean-de-Luz", "Hendaye", "Mourenx"],
};

// ── Config ──
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const SCRAPER_URL = process.env.SCRAPER_URL || "http://localhost:8001";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_MSG_SID = process.env.TWILIO_MESSAGING_SERVICE_SID || "";
const RADAR_PHONE = process.env.RADAR_ADMIN_PHONE || "0615907873";
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || "";

// quick:false obligatoire : le mode quick ne remonte pas les telephones, or le
// filtre exige un phone -> le radar trouvait 0 nouveau par construction.
// limit 10 pour contenir la duree (~60 s par scrape en mode complet).
const SCRAPE_LIMIT = 10;
const SCRAPE_TIMEOUT_MS = 240_000;

const log = (...a) => console.log(new Date().toISOString(), ...a);

function toE164(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("33")) return `+${digits}`;
  if (digits.startsWith("0")) return `+33${digits.slice(1)}`;
  return `+${digits}`;
}

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

/** GET pagine sur une table (Supabase REST plafonne a 1000 lignes/requete). */
async function sbSelectAll(path) {
  const out = [];
  let offset = 0;
  const pageSize = 1000;
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${sep}limit=${pageSize}&offset=${offset}`, { headers: sbHeaders });
    if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status} ${await res.text().catch(() => "")}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

/** Upsert (ignore les doublons sur maps_url) et renvoie les lignes reellement inserees. */
async function sbInsert(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/prospects?on_conflict=maps_url`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase INSERT: ${res.status} ${await res.text().catch(() => "")}`);
  const inserted = await res.json().catch(() => []);
  return Array.isArray(inserted) ? inserted : [];
}

function cleanWebsite(c) {
  const w = (c.website ?? "").trim();
  if (!w || w === "yes" || w === "non") return null;
  return w;
}

/** Notif Telegram (HTML). Renvoie false si non configure ou en erreur. */
async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return false;
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram: ${res.status} ${await res.text().catch(() => "")}`);
  return true;
}

async function sendSms(body) {
  const form = new URLSearchParams({ To: toE164(RADAR_PHONE), MessagingServiceSid: TWILIO_MSG_SID, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) throw new Error(`Twilio: ${res.status} ${await res.text().catch(() => "")}`);
  return res.json();
}

async function main() {
  // Validation config — il faut Supabase + au moins un canal de notif (Telegram prefere, SMS fallback)
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_KEY) missing.push("SUPABASE_KEY");
  const hasTelegram = !!(TG_TOKEN && TG_CHAT);
  const hasTwilio = !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_MSG_SID);
  if (!hasTelegram && !hasTwilio) missing.push("TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID (ou TWILIO_*)");
  if (missing.length) {
    log("ERREUR config manquante:", missing.join(", "));
    process.exit(1);
  }

  log("Radar VPS — demarrage. Scraper:", SCRAPER_URL);

  // 1. Combos actifs (metier, region) — dedup en JS
  const comboRows = await sbSelectAll("prospects?select=metier,region&metier=not.is.null&region=not.is.null");
  const seen = new Set();
  const combos = [];
  for (const r of comboRows) {
    if (!r.metier || !r.region) continue;
    const k = `${r.metier}|${r.region}`;
    if (seen.has(k)) continue;
    seen.add(k);
    combos.push({ metier: r.metier, region: r.region });
  }

  // 2. maps_url existants pour dedup
  const existing = await sbSelectAll("prospects?select=maps_url&maps_url=not.is.null");
  const knownUrls = new Set(existing.map((r) => r.maps_url));
  log(`${combos.length} combos, ${knownUrls.size} fiches connues.`);

  // 3. Scanner chaque combo × ville
  const summary = {};
  let totalInserted = 0;
  const newOnes = []; // lignes reellement inserees (pour le recap Telegram detaille)
  const errors = [];
  let scrapeCount = 0;

  for (const { metier, region } of combos) {
    const cities = REGION_CITIES[region];
    if (!cities) { log(`(skip) pas de villes pour region "${region}"`); continue; }

    for (const ville of cities) {
      scrapeCount++;
      try {
        const res = await fetch(`${SCRAPER_URL}/scrape`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metier, ville, limit: SCRAPE_LIMIT, quick: false }),
          signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
        });
        if (!res.ok) { errors.push(`${metier}/${ville}: HTTP ${res.status}`); continue; }

        const json = await res.json();
        const competitors = json.competitors ?? [];

        const fresh = competitors.filter((c) => {
          if (!c.name || !c.phone) return false;
          const ws = (c.website ?? "").trim().toLowerCase();
          if (ws && ws !== "yes" && ws !== "non" && ws.startsWith("http")) return false;
          if (c.maps_url && knownUrls.has(c.maps_url)) return false;
          return true;
        });
        if (fresh.length === 0) continue;

        const rows = fresh.map((c) => ({
          name: c.name,
          metier,
          phone: c.phone,
          ville,
          region,
          rating: c.rating ? parseFloat(c.rating) || null : null,
          reviews: c.reviews ? parseInt(c.reviews, 10) || null : null,
          address: c.address || null,
          maps_url: c.maps_url || null,
          website: cleanWebsite(c),
          status: "todo",
          source: "radar",
          radar_detected_at: new Date().toISOString(),
        }));

        const inserted = await sbInsert(rows);
        if (inserted.length > 0) {
          const label = `${metier} ${region}`;
          summary[label] = (summary[label] ?? 0) + inserted.length;
          totalInserted += inserted.length;
          newOnes.push(...inserted);
          for (const c of fresh) if (c.maps_url) knownUrls.add(c.maps_url);
          log(`+${inserted.length} ${metier}/${ville}`);
        }
      } catch (e) {
        errors.push(`${metier}/${ville}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  log(`Termine. ${scrapeCount} scrapes, ${totalInserted} nouveaux prospects.`);
  if (errors.length) log(`${errors.length} erreurs:`, errors.slice(0, 15).join(" | "));

  // 4. Recap si nouveaux — Telegram (riche : noms + telephones), fallback SMS
  if (totalInserted > 0) {
    const detail = Object.entries(summary).map(([k, v]) => `${v} ${k}`).join(", ");
    try {
      const MAX_LISTED = 15;
      const lines = newOnes.slice(0, MAX_LISTED).map(
        (p) => `• <b>${p.name}</b> — ${p.metier}, ${p.ville}${p.phone ? ` · 📞 ${String(p.phone).replace(/\s/g, "")}` : ""}`,
      );
      if (newOnes.length > MAX_LISTED) lines.push(`… et ${newOnes.length - MAX_LISTED} autres dans l'app.`);
      const sentTg = await sendTelegram(
        `📡 <b>Radar : ${totalInserted} nouveau${totalInserted > 1 ? "x" : ""} prospect${totalInserted > 1 ? "s" : ""} cette nuit</b>\n(${detail})\n\n${lines.join("\n")}`,
      );
      if (sentTg) {
        log("Recap Telegram envoye.");
      } else {
        await sendSms(`Radar: ${totalInserted} nouveaux prospects detectes cette nuit (${detail}). Ouvre l'app pour les voir.`);
        log("SMS recap envoye a", toE164(RADAR_PHONE));
      }
    } catch (e) {
      log("ERREUR notif recap:", e instanceof Error ? e.message : String(e));
    }
  } else {
    // RAS : on previent quand meme par Telegram (sinon impossible de savoir si le radar a tourne).
    try {
      await sendTelegram(
        `📡 Radar : RAS cette nuit — ${scrapeCount} scrapes, 0 nouveau prospect.${errors.length ? `\n⚠️ ${errors.length} erreurs de scrape.` : ""}\nLes zones actuelles sont couvertes : pense à ajouter des villes/métiers.`,
      );
      log("Recap Telegram RAS envoye.");
    } catch (e) {
      log("ERREUR notif RAS:", e instanceof Error ? e.message : String(e));
    }
  }
}

main().catch((e) => { log("FATAL:", e instanceof Error ? e.stack : String(e)); process.exit(1); });
