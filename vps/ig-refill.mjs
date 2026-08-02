#!/usr/bin/env node
/**
 * Refill de la selection Instagram — version VPS (boucle complete, sans mur de temps).
 *
 * Pourquoi ici et pas sur Vercel : une invocation Vercel meurt a 300 s, ce qui
 * plafonne une passe de refill a ~1 collecte + ~37 profils resolus + 1 lot Claude.
 * Pour pourvoir les ~49 creneaux d'une journee de chauffe il en faut 7 a 10.
 * Le cron du matin ne pouvait donc structurellement pas remplir la journee, et le
 * bouton « Aller en chercher » du cockpit n'etait que le rattrapage manuel de ce
 * plafond (constat du 01/08/2026 : 33 qualifies en stock pour 49 creneaux).
 *
 * Ce script rappelle /api/cron/ig-refill en boucle jusqu'a ce que la selection
 * soit pleine. Chaque appel reste court et autonome : une passe tuee en vol est
 * rattrapee par la suivante, puisque le refill commence toujours par qualifier
 * ce qui traine sans verdict.
 *
 * Aucune dependance npm — juste Node >= 18 (fetch natif).
 *
 * Lancer en cron toutes les 30 min sur la matinee — la ligne exacte est dans
 * DEPLOY.md (« Refill automatique de la selection »), pas ici : une expression
 * cron contient la sequence qui fermerait ce commentaire.
 *
 * Variables requises (dans radar.env) :
 *   CRON_SECRET  — le meme que dans Vercel
 * Optionnelles :
 *   APP_URL              (defaut https://prospects.nmf-agence.com)
 *   IG_REFILL_MAX_PASSES (defaut 12)   — borne dure du nombre d'appels
 *   IG_REFILL_QUOTA_FLOOR              — on s'arrete si le quota du fournisseur
 *     passe sous ce seuil. SANS valeur, le plancher est PROPORTIONNEL au plan :
 *     10 % du plafond mensuel (min 5). L'ancien defaut fixe de 1500 etait pense
 *     pour le plan Pro (15 000/mois) : en gratuit (150/mois) il etait TOUJOURS
 *     au-dessus du quota → la boucle s'auto-desactivait a la passe 0 et la
 *     selection du matin restait vide — c'etait CA, le bouton a cliquer.
 *   IG_REFILL_MAX_MINUTES(defaut 40)   — borne dure de duree totale
 */

const APP_URL = (process.env.APP_URL || "https://prospects.nmf-agence.com").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET || "";
const MAX_PASSES = Number(process.env.IG_REFILL_MAX_PASSES) || 12;
const QUOTA_FLOOR_ENV = Number(process.env.IG_REFILL_QUOTA_FLOOR) || 0;
const MAX_MS = (Number(process.env.IG_REFILL_MAX_MINUTES) || 40) * 60_000;

/** Plancher de reserve : env si posee, sinon 10 % du plafond du plan (min 5). */
const quotaFloor = (limit) => QUOTA_FLOOR_ENV || Math.max(5, Math.round((Number(limit) || 0) * 0.1));

const log = (...a) => console.log(new Date().toISOString().slice(0, 19).replace("T", " "), ...a);

if (!SECRET) {
  log("ERREUR: CRON_SECRET manquant (radar.env).");
  process.exit(1);
}

/** Un appel a la route. `qs` porte mode=status / notify=1. */
async function call(qs = "") {
  const res = await fetch(`${APP_URL}/api/cron/ig-refill${qs}`, {
    method: "POST",
    headers: { "x-cron-secret": SECRET },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`reponse illisible (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

/** Un appel au canari (/api/health/ig). Renvoie le rapport, ou null si injoignable. */
async function canari() {
  const res = await fetch(`${APP_URL}/api/health/ig?notify=1`, {
    method: "POST",
    headers: { "x-cron-secret": SECRET },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`canari illisible (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

const started = Date.now();
let passes = 0;
let stop = "";

// ── Canari : on verifie que la chaine REPOND avant d'en dependre.
//
// Le 02/08 la boucle a tourne 12 passes et 831 s en produisant zero verdict :
// le modele renvoyait 404, `qualifyProfiles` avalait l'erreur lot par lot, et
// rien dans la reponse ne disait que l'IA etait morte. Chaque passe a resolu des
// profils (1 requete de quota piece) pour fabriquer du stock que personne n'a
// qualifie. Trente secondes de verification valent mieux que ca.
//
// Un canari injoignable n'arrete PAS la boucle : c'est un garde-fou, pas une
// dependance de plus. On le dit et on continue.
try {
  const sante = await canari();
  log(`canari : ${sante.resume}`);
  for (const c of sante.checks || []) {
    if (!c.ok || c.alerte) log(`  ${c.ok ? "!" : "X"} ${c.poste} — ${c.detail}`);
  }
  if (!sante.ok) {
    log("fin — chaine cassee, aucune passe lancee (alerte Telegram envoyee par le canari).");
    process.exit(0);
  }
} catch (e) {
  log(`canari injoignable (${e.message}) — on continue quand meme.`);
}

// Sonde d'entree : si la selection est deja pleine, on ne depense rien.
let state = await call("?mode=status");
log(`etat initial : ${state.selected}/${state.slots} creneaux, manque ${state.shortfall}, stock ${state.stock}, file ${state.pending}` +
  (state.quota ? `, quota ${state.quota.remaining}/${state.quota.limit}` : ""));

while (state.shortfall > 0) {
  if (passes >= MAX_PASSES) { stop = `plafond de ${MAX_PASSES} passes`; break; }
  if (Date.now() - started > MAX_MS) { stop = "duree max atteinte"; break; }
  // Plancher applique seulement APRES la premiere passe : la sonde d'entree lit
  // le quota PERSISTE en base, qui peut dater d'avant un changement de plan
  // (ex. passage au payant : la ligne dit encore « 3/150 » alors que le vrai
  // plafond est 15 000). La premiere passe rafraichit le quota avec les headers
  // reels du fournisseur — c'est sur CES chiffres qu'on decide de continuer.
  if (passes >= 1 && state.quota) {
    const floor = quotaFloor(state.quota.limit);
    if (state.quota.remaining < floor) {
      stop = `quota ${state.quota.provider} sous le plancher (${state.quota.remaining} < ${floor})`;
      break;
    }
  }

  passes++;
  let pass;
  try {
    pass = await call();
  } catch (e) {
    // Une passe qui casse (timeout Vercel, source a terre) ne doit pas tuer la
    // boucle : la suivante repart de l'etat reel, qui n'a fait qu'avancer.
    log(`passe ${passes} en echec : ${e.message}`);
    if (passes >= MAX_PASSES) { stop = "echecs repetes"; break; }
    continue;
  }

  const r = pass.refill || {};
  const detail = (r.steps || []).map((s) => `${s.mode}${s.metier ? `:${s.metier}` : ""}${s.qualified != null ? `(+${s.qualified})` : ""}`).join(" ");
  log(`passe ${passes} : ${detail || r.reason || "rien"} -> ${pass.selected}/${pass.slots}, manque ${pass.shortfall}, stock ${pass.stock}, file ${pass.pending}`);

  state = pass;

  // Qualification IA en panne (credits Anthropic, cle, modele) : chaque passe
  // supplementaire brulerait du quota looter pour des profils que personne ne
  // triera. On coupe et on alerte tout de suite.
  if (r.iaError) { stop = `IA en panne : ${r.iaError.slice(0, 160)}`; break; }

  // Le refill dit lui-meme qu'il n'a plus de marche disponible : insister
  // reviendrait a retaper une source a terre ou une bibliotheque epuisee.
  if (r.ran === false) { stop = `refill a court de marches (${r.reason || "sans raison"})`; break; }
}

if (!stop) stop = state.shortfall > 0 ? "arret" : "selection pleine";
log(`fin en ${passes} passe(s), ${Math.round((Date.now() - started) / 1000)} s — ${stop}`);

// Recap Telegram : seulement s'il reste des creneaux vides (sinon on ne notifie
// pas une journee qui s'est bien passee — le digest du matin suffit).
if (state.shortfall > 0) {
  try {
    await call("?mode=status&notify=1");
    log("alerte Telegram envoyee.");
  } catch (e) {
    log(`alerte Telegram impossible : ${e.message}`);
  }
}

process.exit(0);
