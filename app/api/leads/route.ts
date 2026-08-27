import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { sendTelegram } from "@/app/lib/notify";
import { sendEmail } from "@/app/lib/email";
import { sendSms } from "@/app/lib/smsNotify";
import { parseLead, parseTracking, leadNotification, leadSmsNotification, makeToken } from "@/app/lib/adsLeads";
import { leadEmail } from "@/app/lib/adsLeadEmail";
import { uploadClickConversion } from "@/app/lib/googleAds/conversions";

/**
 * POST /api/leads
 *
 * Réception d'un contact venu d'une landing page Google Ads. C'est l'endpoint
 * que `LEAD_FORWARD_URL` désigne côté projet des landing pages.
 *
 * Deux natures de contact, distinguées par `kind` :
 *  - `"form"` (défaut) — une demande de devis écrite. Le reste de ce commentaire
 *    la décrit ;
 *  - `"call"` — un clic sur le numéro de téléphone. Table à part, action de
 *    conversion à part, aucune notification. Voir `enregistrerAppel` en bas de
 *    ce fichier.
 *
 * Trois choses, dans cet ordre, et la première seule est bloquante :
 *  1. écrire le lead — sans ça la demande est perdue ;
 *  2. prévenir l'artisan, avec le lien de qualification ;
 *  3. rendre le ticket à Google — « Demande de devis », à J0.
 *
 * Un échec sur 2 ou 3 ne fait jamais échouer la requête : le lead est déjà en
 * base, la conversion se rattrape, la notification se relit. Ce qu'on refuse,
 * c'est de répondre `ok` sans avoir écrit.
 *
 * Authentification par jeton partagé, en `Authorization: Bearer`. La route est
 * ouverte dans le middleware, donc c'est ce contrôle-ci qui la protège.
 */

export const dynamic = "force-dynamic";

const SECRET = process.env.LEAD_INGEST_SECRET ?? "";

/**
 * L'origine du lien de qualification, celle que l'artisan ouvrira.
 *
 * Le repli est le domaine de l'agence, PAS l'URL technique `*.vercel.app`.
 * Ce lien part par e-mail et par SMS chez un client : il est lu, parfois
 * recopié, et il porte le nom de la boîte. Une adresse en `vercel.app` dit à
 * l'artisan qu'on lui envoie un outil de dev, et les filtres anti-spam
 * n'aiment pas non plus les domaines mutualisés d'hébergeur.
 *
 * `NEXT_PUBLIC_DEMO_BASE_URL` est accepté en second : c'est la variable que le
 * reste de l'application utilise déjà pour la même chose, et deux conventions
 * qui se contredisent finissent toujours par produire un lien mort.
 */
const PUBLIC_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_DEMO_BASE_URL ||
  "https://prospects.nmf-agence.com"
).replace(/\/$/, "");

/** Fenêtre pendant laquelle un formulaire identique est tenu pour un rejeu. */
const REJEU_MINUTES = 5;

/**
 * Idem pour un appel, mais plus court. On raccroche, on reclique, on retombe
 * sur un répondeur et on réessaie : c'est le même appel. Au-delà de deux
 * minutes, c'est un visiteur qui rappelle vraiment, et ça compte.
 */
const REJEU_APPEL_MINUTES = 2;

export async function POST(req: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: "LEAD_INGEST_SECRET non configuré" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase (clé secrète) non configuré" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const slug = typeof body.client === "string" && body.client ? body.client : "totowood";

  const kind = typeof body.kind === "string" ? body.kind : "form";
  if (kind !== "form" && kind !== "call") {
    return NextResponse.json({ error: `Type de demande inconnu : ${kind}` }, { status: 400 });
  }

  const { data: client } = await supabaseAdmin
    .from("ads_clients")
    .select("slug, label, customer_id, action_request, action_call, notify_email, notify_telegram, notify_sms")
    .eq("slug", slug)
    .single();
  if (!client) {
    return NextResponse.json({ error: `Client « ${slug} » inconnu` }, { status: 404 });
  }

  /* Un appel n'est pas une demande de devis amputée : le visiteur ne laisse ni
     nom, ni message, ni numéro où le rappeler. Il part vers sa propre table et
     sa propre action de conversion, et il ne déclenche aucune notification —
     le téléphone de l'artisan sonne, c'est la notification. Voir la
     migration 036 pour le raisonnement complet. */
  if (kind === "call") return enregistrerAppel(body, client);

  const parsed = parseLead(body, slug, makeToken());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const row = parsed.row;

  // ── 0. Le rejeu. Double-clic, retour arrière, renvoi du formulaire : la même
  // demande arrive deux fois en quelques secondes. On la reconnaît au numéro et
  // au message, sur une fenêtre courte — au-delà, c'est un client qui rappelle,
  // et sa deuxième demande a le droit d'exister.
  const depuis = new Date(Date.now() - REJEU_MINUTES * 60_000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("ads_leads")
    .select("id")
    .eq("client_slug", slug)
    .eq("phone", row.phone)
    .eq("message", row.message)
    .gte("received_at", depuis)
    .limit(1)
    .maybeSingle();
  if (recent) return NextResponse.json({ ok: true, id: recent.id, duplicate: true });

  // ── 1. Écrire. Le seul échec qui doit remonter au formulaire.
  const { data: lead, error } = await supabaseAdmin
    .from("ads_leads")
    .insert(row)
    .select("id, token, received_at")
    .single();

  if (error) {
    console.error("[leads] écriture impossible", error);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }

  const qualifyUrl = `${PUBLIC_URL}/q/${lead.token}`;

  // ── 2. Prévenir. Un lead qu'on n'annonce pas est un lead qu'on rappelle trop tard.
  const texte = leadNotification(row, client.label, qualifyUrl);
  const taches: Promise<unknown>[] = [];
  if (client.notify_telegram) taches.push(sendTelegram(texte));
  if (client.notify_email) {
    /* Le gabarit vit dans `adsLeadEmail.ts` : c'est le seul des trois canaux
       qui ait une mise en forme, et elle n'a rien à faire dans une route. */
    const mail = leadEmail(row, client.label, qualifyUrl, new Date(lead.received_at));
    taches.push(
      sendEmail({
        to: client.notify_email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        /* Répondre à la notification écrit au client, pas dans le vide. Les
           demandes sans e-mail gardent l'expéditeur par défaut. */
        ...(row.email ? { replyTo: row.email } : {}),
      }),
    );
  }

  /* Le SMS en dernier des trois, et c'est voulu : c'est le seul qui coûte de
     l'argent. Pas de numéro, pas d'envoi — la colonne porte le numéro et non
     un booléen, donc l'état « activé mais sans numéro » n'existe pas. */
  if (client.notify_sms) {
    taches.push(
      sendSms({
        to: client.notify_sms,
        body: leadSmsNotification(row, client.label, qualifyUrl),
        statusCallback: PUBLIC_URL + "/api/sms/status",
      }),
    );
  }

  // ── 3. Rendre le ticket à Google, tout de suite. À J0 on est très loin de la
  // limite des 90 jours, et le compte a du signal dès la première semaine.
  const envoi = uploadClickConversion({
    customerId: client.customer_id || "",
    conversionAction: client.action_request || "",
    gclid: row.gclid || "",
    at: new Date(lead.received_at),
    orderId: lead.id,
  });

  const [, resultat] = await Promise.all([Promise.allSettled(taches), envoi]);

  if (resultat.ok) {
    await supabaseAdmin
      .from("ads_leads")
      .update({ request_uploaded_at: new Date().toISOString(), upload_error: null })
      .eq("id", lead.id);
  } else if (!resultat.skipped) {
    console.error("[leads] conversion non remontée", resultat.error);
    await supabaseAdmin.from("ads_leads").update({ upload_error: resultat.error }).eq("id", lead.id);
  }

  return NextResponse.json({ ok: true, id: lead.id });
}

/**
 * Un clic sur le numéro de téléphone d'une landing page.
 *
 * Ce qu'on mesure : le clic, pas l'appel décroché. Sur mobile c'est un signal
 * d'intention très fort — le clic ouvre le composeur. Sur ordinateur c'est plus
 * faible : le visiteur lit le numéro et compose sur son propre téléphone sans
 * jamais cliquer. La colonne `device` permet de faire la part des choses.
 *
 * On n'utilise pas le suivi des appels natif de Google, qui exige la balise
 * gtag.js, donc des cookies publicitaires, donc un bandeau de consentement —
 * alors que la politique de confidentialité de ces pages promet noir sur blanc
 * « aucun cookie publicitaire ». Le clic passe par notre propre API, comme le
 * formulaire, et la conversion est rendue à Google par l'API avec le gclid.
 */
async function enregistrerAppel(
  body: Record<string, unknown>,
  client: { slug: string; customer_id: string | null; action_call: string | null },
) {
  const tracking = parseTracking(body.tracking);

  // ── 0. Le rejeu, même principe que pour un formulaire.
  const depuis = new Date(Date.now() - REJEU_APPEL_MINUTES * 60_000).toISOString();
  const base = supabaseAdmin
    .from("ads_calls")
    .select("id")
    .eq("client_slug", client.slug)
    .gte("clicked_at", depuis);
  /* Sans gclid, on n'a pas de quoi distinguer deux visiteurs : on se rabat sur
     la page. C'est volontairement grossier — un clic sans gclid ne remontera
     de toute façon jamais à Google, il n'a de valeur que statistique. */
  const { data: recent } = await (tracking.gclid
    ? base.eq("gclid", tracking.gclid)
    : base.is("gclid", null).eq("landing", tracking.landing ?? "")
  )
    .limit(1)
    .maybeSingle();
  if (recent) return NextResponse.json({ ok: true, id: recent.id, duplicate: true });

  // ── 1. Écrire. Seul échec qui remonte.
  const { data: appel, error } = await supabaseAdmin
    .from("ads_calls")
    .insert({ client_slug: client.slug, ...tracking })
    .select("id, clicked_at")
    .single();

  if (error) {
    console.error("[calls] écriture impossible", error);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }

  // ── 2. Rendre le ticket à Google. Tant que l'action n'existe pas dans le
  // compte Ads, `uploadClickConversion` répond `skipped` et le clic reste en
  // base : il repartira quand `action_call` sera renseignée.
  const resultat = await uploadClickConversion({
    customerId: client.customer_id || "",
    conversionAction: client.action_call || "",
    gclid: tracking.gclid || "",
    at: new Date(appel.clicked_at),
    orderId: appel.id,
  });

  if (resultat.ok) {
    await supabaseAdmin
      .from("ads_calls")
      .update({ uploaded_at: new Date().toISOString(), upload_error: null })
      .eq("id", appel.id);
  } else if (!resultat.skipped) {
    console.error("[calls] conversion non remontée", resultat.error);
    await supabaseAdmin.from("ads_calls").update({ upload_error: resultat.error }).eq("id", appel.id);
  }

  return NextResponse.json({ ok: true, id: appel.id });
}
