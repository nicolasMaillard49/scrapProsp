/**
 * Vérifie de bout en bout la remontée des conversions d'un client, sans rien
 * écrire chez Google : lit la ligne `ads_clients`, contrôle les scopes du jeton,
 * puis envoie les deux actions en `validateOnly`.
 *
 *   node --env-file=.env.local scripts/check-conversions.mjs [slug]
 *
 * Sort en code 1 dès qu'un maillon manque, pour servir de garde avant une mise
 * en ligne de campagne. Une campagne qui tourne sans remontée dépense en aveugle.
 */
import { createClient } from "@supabase/supabase-js";

const slug = process.argv[2] || "totowood";
const DATA_MANAGER_SCOPE = "https://www.googleapis.com/auth/datamanager";
const ADWORDS_SCOPE = "https://www.googleapis.com/auth/adwords";

let fautes = 0;
const ko = (m) => {
  console.error(`✗ ${m}`);
  fautes++;
};
const ok = (m) => console.log(`✓ ${m}`);

/* ── 1. La base ────────────────────────────────────────────────────────────── */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data: client, error } = await db
  .from("ads_clients")
  .select("slug, label, customer_id, action_request, action_sale, notify_email, notify_sms")
  .eq("slug", slug)
  .maybeSingle();

if (error) {
  ko(`lecture ads_clients : ${error.message}`);
  process.exit(1);
}
if (!client) {
  ko(`aucun client « ${slug} » dans ads_clients`);
  process.exit(1);
}

console.log(`=== ${client.label} (${client.slug}) ===\n`);
client.customer_id ? ok(`customer_id ${client.customer_id}`) : ko("customer_id absent");
client.action_request ? ok(`action_request ${client.action_request}`) : ko("action_request absente");
client.action_sale ? ok(`action_sale ${client.action_sale}`) : ko("action_sale absente");
client.notify_email ? ok(`notify_email ${client.notify_email}`) : ko("notify_email absent");
client.notify_sms ? ok(`notify_sms ${client.notify_sms}`) : ko("notify_sms absent");

if (fautes) {
  console.error(`\n${fautes} maillon(s) manquant(s) en base. On s'arrête ici.`);
  process.exit(1);
}

/* ── 2. Les scopes du jeton ────────────────────────────────────────────────── */
const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
});
const jeton = await res.json();
if (!res.ok || !jeton.access_token) {
  ko(`échange du refresh token : ${jeton.error_description || jeton.error || res.status}`);
  process.exit(1);
}
console.log("");
const scopes = (jeton.scope || "").split(" ");
scopes.includes(ADWORDS_SCOPE) ? ok("scope adwords") : ko("scope adwords absent");
scopes.includes(DATA_MANAGER_SCOPE)
  ? ok("scope datamanager")
  : ko("scope datamanager absent — rejouer scripts/google-oauth-consent.mjs");

/*
 * On ne sort PAS ici même si le scope datamanager manque : le test d'ajustement
 * ci-dessous ne dépend que du scope adwords, et savoir que cette moitié de la
 * chaîne tient vaut mieux qu'un rapport tronqué. Le code de sortie tombe à la fin.
 */
const envoiPossible = scopes.includes(DATA_MANAGER_SCOPE);

/* ── 3. L'appel réel, sans écriture ────────────────────────────────────────── */
const MCC = (process.env.GOOGLE_ADS_MCC_ID || "6711813801").replace(/-/g, "");
const idAction = (r) => (String(r).match(/conversionActions\/(\d+)/) || [, String(r)])[1];

async function essai(nom, action, valeur) {
  const event = {
    eventTimestamp: new Date().toISOString().replace(/\.\d+Z$/, "+00:00"),
    transactionId: `sonde-${slug}-${nom.replace(/\W+/g, "-")}`,
    adIdentifiers: { gclid: "SONDE-VALIDATE-ONLY" },
    eventSource: "WEB",
  };
  if (valeur !== undefined) {
    event.conversionValue = valeur;
    event.currency = "EUR";
  }

  const r = await fetch("https://datamanager.googleapis.com/v1/events:ingest", {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      destinations: [
        {
          operatingAccount: { accountType: "GOOGLE_ADS", accountId: client.customer_id },
          loginAccount: { accountType: "GOOGLE_ADS", accountId: MCC },
          productDestinationId: idAction(action),
        },
      ],
      events: [event],
      validateOnly: true,
      consent: { adPersonalization: "CONSENT_GRANTED", adUserData: "CONSENT_GRANTED" },
    }),
  });
  const corps = await r.json().catch(() => ({}));
  if (!r.ok) {
    ko(`${nom} : HTTP ${r.status} — ${corps?.error?.message || "(sans message)"}`);
    return;
  }
  ok(`${nom} : requête acceptée (validateOnly) sur l'action ${idAction(action)}`);
}

console.log("");
if (envoiPossible) {
  await essai("envoi · Demande de devis", client.action_request);
  await essai("envoi · Devis signé", client.action_sale, 4200);
} else {
  console.log("· envoi · non testé, le scope datamanager manque");
}

/* ── 4. L'ajustement, qui passe par l'AUTRE API ────────────────────────────── */
/*
 * L'envoi va sur la Data Manager API, la correction de valeur reste sur l'API
 * Google Ads : c'est le seul service à offrir un vrai RESTATEMENT. Deux APIs,
 * deux scopes, deux façons d'échouer — on vérifie les deux ou on ne vérifie rien.
 *
 * L'order_id de sonde ne correspond à aucune conversion réelle : Google doit
 * répondre CONVERSION_NOT_FOUND. C'est le succès attendu — il prouve que le
 * service répond et n'est pas fermé. Toute autre réponse est un vrai problème.
 */
const { GoogleAdsApi } = await import("google-ads-api");
const ads = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

try {
  const res = await ads
    .Customer({
      customer_id: client.customer_id,
      login_customer_id: MCC,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    })
    .conversionAdjustmentUploads.uploadConversionAdjustments({
      customer_id: client.customer_id,
      conversion_adjustments: [
        {
          conversion_action: client.action_sale,
          adjustment_type: "RESTATEMENT",
          adjustment_date_time: new Date()
            .toISOString()
            .replace("T", " ")
            .replace(/\.\d+Z$/, "+00:00"),
          order_id: `sonde-${slug}-inexistante`,
          restatement_value: { adjusted_value: 4200, currency_code: "EUR" },
        },
      ],
      partial_failure: true,
      validate_only: true,
    });
  const rejet = res?.partial_failure_error?.message || "";
  if (/limited to existing users|Data Manager API/i.test(rejet)) {
    ko(`ajustement · service fermé : ${rejet}`);
  } else if (/can't be found|CONVERSION_NOT_FOUND/i.test(rejet)) {
    ok("ajustement · service ouvert (CONVERSION_NOT_FOUND attendu sur la sonde)");
  } else {
    ok(`ajustement · service ouvert — réponse : ${rejet || "aucun rejet"}`);
  }
} catch (e) {
  ko(`ajustement · ${e?.errors?.[0]?.message || e?.message || String(e)}`);
}

if (fautes) {
  console.error(`\n${fautes} faute(s).`);
  process.exit(1);
}
console.log("\nLa chaîne tient, envoi et ajustement. Le gclid de sonde est factice :");
console.log("seul un vrai clic prouvera le reste.");
