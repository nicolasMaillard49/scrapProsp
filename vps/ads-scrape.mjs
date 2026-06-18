#!/usr/bin/env node
/**
 * Scrape progressif "prospection Ads" — version VPS, resumable.
 *
 * Parcourt les villes de ads-cities.mjs (>= 5000 hab, jamais scannees par le
 * radar, population decroissante), ville par ville x metiers Ads, par batchs
 * de 100 scrapes (ADS_BATCH). L'etat est persiste dans ads-scrape.state.json :
 * chaque run reprend ou le precedent s'est arrete, puis s'arrete -> a lancer
 * en cron (toutes les 2 h en journee) ou a la main.
 *
 * Difference avec le radar : on GARDE les fiches qui ont deja un site web
 * (ce sont justement des cibles Ads) ; source='ads' pour les filtrer dans l'app.
 *
 * Cron :
 *   15 7-23/2 * * * cd /home/deploy/scrapProsp/vps && set -a && . ./radar.env && set +a && flock -n /tmp/ads-scrape.lock node ads-scrape.mjs >> /home/deploy/ads-scrape.log 2>&1
 *
 * Env requis (radar.env) : SUPABASE_URL, SUPABASE_KEY,
 * TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID. Optionnel : SCRAPER_URL, ADS_BATCH.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ADS_CITIES } from "./ads-cities.mjs";

// Metiers a forte intention/panier pour les Google Ads (cf. docs/prospection-ads-villes.md)
const METIERS = ["plombier", "serrurier", "chauffagiste", "couvreur", "vitrier", "demenageur", "paysagiste"];

// La colonne prospects.departement stocke des NOMS ("Cantal"), pas des codes.
const DEPT_NAMES = {
  "03": "Allier", "08": "Ardennes", "09": "Ariège", "10": "Aube", "12": "Aveyron",
  "14": "Calvados", "15": "Cantal", "16": "Charente", "17": "Charente-Maritime", "18": "Cher",
  "19": "Corrèze", "21": "Côte-d'Or", "23": "Creuse", "27": "Eure", "28": "Eure-et-Loir",
  "32": "Gers", "36": "Indre", "37": "Indre-et-Loire", "41": "Loir-et-Cher", "45": "Loiret",
  "46": "Lot", "48": "Lozère", "50": "Manche", "51": "Marne", "52": "Haute-Marne",
  "54": "Meurthe-et-Moselle", "55": "Meuse", "57": "Moselle", "58": "Nièvre", "61": "Orne",
  "63": "Puy-de-Dôme", "64": "Pyrénées-Atlantiques", "65": "Hautes-Pyrénées", "71": "Saône-et-Loire",
  "76": "Seine-Maritime", "79": "Deux-Sèvres", "81": "Tarn", "82": "Tarn-et-Garonne",
  "86": "Vienne", "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "43": "Haute-Loire",
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const SCRAPER_URL = process.env.SCRAPER_URL || "http://localhost:8001";
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || "";

const BATCH = Number.parseInt(process.env.ADS_BATCH || "100", 10);
// quick:false obligatoire : le mode quick ne remonte PAS les telephones (liste
// Maps seule), or le filtre exige un phone -> tout serait jete silencieusement.
// limit 10 (top resultats) pour garder ~60 s par combo en mode complet.
const SCRAPE_LIMIT = 10;
const SCRAPE_TIMEOUT_MS = 240_000;
const STATE_FILE = new URL("./ads-scrape.state.json", import.meta.url).pathname;

const log = (...a) => console.log(new Date().toISOString(), ...a);

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

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

/** Forme canonique FR du téléphone = 9 derniers chiffres. "" si inexploitable. */
function normPhone(phone) {
  const d = (phone || "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
}

function cleanWebsite(c) {
  const w = (c.website ?? "").trim();
  // Les resultats sponsorises Maps renvoient une URL de redirection "/aclk?..."
  // (signal interessant : l'artisan paie deja des Ads) — mais inutilisable comme site.
  if (!w || !w.startsWith("http")) return null;
  return w;
}

/** Resultat sponsorise Maps ("/aclk?...") = il paie DEJA des Google Ads. */
function isSponsoredResult(c) {
  return (c.website ?? "").trim().startsWith("/aclk");
}

/**
 * Detecte le tag de conversion/remarketing Google Ads dans le HTML du site
 * (gtag "AW-...", googleads.g.doubleclick.net, googleadservices.com).
 * Site injoignable ou douteux -> false : on ne peut pas conclure, on garde le prospect.
 */
async function hasGoogleAdsTag(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) return false;
    const html = await res.text();
    return /AW-\d{6,}/.test(html) || /googleads\.g\.doubleclick\.net|googleadservices\.com/.test(html);
  } catch {
    return false;
  }
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { index: 0, done: false };
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { index: 0, done: false };
  }
}

async function main() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_KEY) missing.push("SUPABASE_KEY");
  if (missing.length) {
    log("ERREUR config manquante:", missing.join(", "));
    process.exit(1);
  }

  // Combos ville-major : toutes les recherches d'une ville avant de passer a la suivante.
  const combos = ADS_CITIES.flatMap((c) => METIERS.map((metier) => ({ ...c, metier })));
  const state = loadState();
  if (state.done) {
    log("Scrape ads deja termine — rien a faire.");
    return;
  }
  const start = state.index;
  const end = Math.min(start + BATCH, combos.length);
  const batchNum = Math.floor(start / BATCH) + 1;
  const batchTotal = Math.ceil(combos.length / BATCH);
  log(`Batch ${batchNum}/${batchTotal} — combos ${start}..${end - 1} sur ${combos.length}.`);

  // Auto-nettoyage : purge les sites "/aclk?..." laisses par d'anciens batchs.
  await fetch(`${SUPABASE_URL}/rest/v1/prospects?website=like./aclk*`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify({ website: null }),
  }).catch(() => {});

  const existing = await sbSelectAll("prospects?select=maps_url&maps_url=not.is.null");
  const knownUrls = new Set(existing.map((r) => r.maps_url));

  // Dédup par TÉLÉPHONE : un même business (zone de service) est listé par Google
  // dans plusieurs villes → même n°, maps_url différents. On filtre sur le n°
  // canonique, sinon ces fiches passent le filtre maps_url et créent des doublons.
  const existingPhones = await sbSelectAll("prospects?select=phone&phone=not.is.null");
  const knownPhones = new Set(existingPhones.map((r) => normPhone(r.phone)).filter(Boolean));

  const summary = {};
  const errors = [];
  let totalInserted = 0;
  let totalSkippedAds = 0;

  for (let i = start; i < end; i++) {
    const { ville, zone, dept, metier } = combos[i];
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

      // Cibles Ads : tout ce qui a nom + telephone (site web GARDE), pas deja en
      // base (ni par maps_url, ni par telephone), et sans doublon dans ce lot.
      const seenPhones = new Set();
      const candidates = competitors.filter((c) => {
        if (!c.name || !c.phone) return false;
        if (c.maps_url && knownUrls.has(c.maps_url)) return false;
        const np = normPhone(c.phone);
        if (np && (knownPhones.has(np) || seenPhones.has(np))) return false;
        if (np) seenPhones.add(np);
        return true;
      });
      if (candidates.length === 0) continue;

      // Exclut ceux qui font DEJA de la pub Google — inutile de leur vendre la semaine test :
      // 1. resultat sponsorise dans Maps ("/aclk?...") = annonceur actif sur cette recherche ;
      // 2. tag de conversion/remarketing Google Ads detecte sur leur site.
      const adChecks = await Promise.all(
        candidates.map(async (c) => {
          if (isSponsoredResult(c)) return true;
          const site = cleanWebsite(c);
          return site ? hasGoogleAdsTag(site) : false;
        }),
      );
      const fresh = candidates.filter((_, idx) => !adChecks[idx]);
      const skipped = candidates.length - fresh.length;
      if (skipped > 0) {
        totalSkippedAds += skipped;
        log(`-${skipped} ${metier}/${ville} (font deja des Ads)`);
      }
      if (fresh.length === 0) continue;

      const rows = fresh.map((c) => ({
        name: c.name,
        metier,
        phone: c.phone,
        ville,
        departement: DEPT_NAMES[dept] ?? dept,
        region: zone,
        rating: c.rating ? parseFloat(c.rating) || null : null,
        reviews: c.reviews ? parseInt(c.reviews, 10) || null : null,
        address: c.address || null,
        maps_url: c.maps_url || null,
        website: cleanWebsite(c),
        status: "todo",
        source: "ads",
      }));

      // Inter-combos du même run : ces n° sont désormais "connus" (la liste DB
      // n'est relue qu'au prochain run). Évite de réinsérer le même business
      // listé sur une autre ville plus loin dans ce batch.
      for (const c of fresh) { const np = normPhone(c.phone); if (np) knownPhones.add(np); }

      const inserted = await sbInsert(rows);
      if (inserted.length > 0) {
        summary[ville] = (summary[ville] ?? 0) + inserted.length;
        totalInserted += inserted.length;
        for (const c of fresh) if (c.maps_url) knownUrls.add(c.maps_url);
        log(`+${inserted.length} ${metier}/${ville}`);
      }
    } catch (e) {
      errors.push(`${metier}/${ville}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const done = end >= combos.length;
  writeFileSync(STATE_FILE, JSON.stringify({ index: end, done }), "utf-8");
  log(`Batch ${batchNum} termine: ${end - start} scrapes, +${totalInserted} prospects, ${totalSkippedAds} ecartes (Ads actifs), ${errors.length} erreurs.`);
  if (errors.length) log("Erreurs:", errors.slice(0, 10).join(" | "));

  const villes = Object.entries(summary).sort((a, b) => b[1] - a[1]);
  const detail = villes.slice(0, 8).map(([v, n]) => `• ${v} : +${n}`).join("\n");
  const next = done ? "" : `\nProchain batch : ${combos[end].metier} à ${combos[end].ville}.`;
  try {
    await sendTelegram(
      `🎯 <b>Scrape Ads — batch ${batchNum}/${batchTotal}</b>\n` +
      `${end - start} scrapes · <b>+${totalInserted} prospects</b> ajoutés (source "ads")` +
      `${totalSkippedAds ? ` · ${totalSkippedAds} écartés (font déjà des Ads)` : ""}` +
      `${errors.length ? ` · ⚠️ ${errors.length} erreurs` : ""}\n` +
      `${detail}${villes.length > 8 ? `\n… et ${villes.length - 8} autres villes` : ""}${next}` +
      (done ? "\n\n🎉 <b>Scrape Ads TERMINÉ</b> — toutes les villes sont passées." : ""),
    );
  } catch (e) {
    log("ERREUR Telegram:", e instanceof Error ? e.message : String(e));
  }
}

main().catch((e) => { log("FATAL:", e instanceof Error ? e.stack : String(e)); process.exit(1); });
