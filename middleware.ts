import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isExtRequestAllowed } from "@/app/lib/extAuth";

const COOKIE_NAME = "prospects-auth";

// Domaine public dédié au funnel d'éligibilité (formulaire client). Sur ce host,
// SEUL le funnel est servi — le tracker interne n'y est jamais exposé.
const FUNNEL_HOST = process.env.FUNNEL_HOST || "eligibilite.nmf-agence.com";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = (req.headers.get("host") || "").toLowerCase();

  const isAsset =
    pathname.startsWith("/_next/") || pathname === "/icon.svg" || pathname === "/favicon.ico";
  // Pages + API publiques du funnel (le formulaire, le rapport, l'activation).
  const isFunnelPath =
    pathname.startsWith("/eligibilite/") ||
    pathname === "/api/eligibilite/submit" ||
    pathname === "/api/eligibilite/launch" ||
    pathname.startsWith("/api/eligibilite/activation-status/");

  // ── Domaine funnel : on n'y sert QUE le funnel. Tout le reste part sur le site NMF.
  if (host === FUNNEL_HOST) {
    if (isFunnelPath || isAsset) return NextResponse.next();
    return NextResponse.redirect("https://www.nmf-agence.com");
  }

  // Routes ouvertes (page de login + démos publiques + assets statiques)
  if (
    pathname === "/login" ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/demo/") ||
    pathname.startsWith("/d/") ||
    pathname.startsWith("/di/") ||
    pathname.startsWith("/templates/") ||
    // Funnel d'éligibilité public (formulaire + rapport ouverts aux prospects).
    // /api/eligibilite/create reste protégé (action interne d'envoi du SMS).
    pathname.startsWith("/eligibilite/") ||
    pathname === "/api/eligibilite/submit" ||
    pathname === "/api/eligibilite/launch" ||
    pathname.startsWith("/api/eligibilite/activation-status/") ||
    pathname === "/api/sms/incoming" ||
    pathname === "/api/sms/status" ||
    pathname === "/api/cron/run-blasts" ||
    pathname === "/api/cron/radar" ||
    pathname === "/api/cron/ig-digest" ||
    pathname === "/api/cron/ig-refill" ||
    pathname === "/api/cron/kpi-slack" ||
    // Canari de la chaîne IG — appelé par le cron VPS avant sa boucle, protégé
    // par le même CRON_SECRET que les crons (cf. app/api/health/ig/route.ts).
    pathname === "/api/health/ig" ||
    // KPI agrégés du cockpit IG (compteurs journaliers, aucune donnée nominative)
    // — consommé par l'Apps Script du Google Sheet de tracking.
    pathname === "/api/instagram/kpi" ||
    pathname === "/api/demo/track" ||
    // Demandes de devis venues des landing pages Google Ads : le POST arrive
    // d'un AUTRE projet Vercel, sans cookie. Sa protection est le jeton partagé
    // que la route vérifie elle-même (LEAD_INGEST_SECRET).
    pathname === "/api/leads" ||
    // Qualification par l'artisan, depuis le lien reçu dans sa notification.
    // Authentifiée par le jeton du lien, long et aléatoire — on ne demande pas
    // un mot de passe à quelqu'un qui répond depuis un chantier.
    pathname === "/api/leads/qualify" ||
    pathname.startsWith("/q/") ||
    // Jumeau du precedent pour les maquettes Instagram (/di) : appele depuis
    // le navigateur DU PROSPECT, donc forcement ouvert.
    pathname === "/api/instagram/demo-view" ||
    pathname === "/api/stripe/webhook" ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  // Extension Chrome (side panel trame DM) : en-tête x-ext-token, borné à
  // /api/instagram/. Cf. app/lib/extAuth.ts pour le pourquoi (SameSite=Lax).
  if (isExtRequestAllowed(pathname, req.headers.get("x-ext-token"), process.env.EXT_TOKEN)) {
    return NextResponse.next();
  }

  const auth = req.cookies.get(COOKIE_NAME);
  if (auth?.value === "ok") {
    return NextResponse.next();
  }

  // Les API répondent 401 JSON : un fetch() suivrait le redirect et prendrait
  // la page /login (HTML 200) pour un succès.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo-nmf.svg).*)"],
};
