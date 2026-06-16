import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    pathname === "/api/demo/track" ||
    pathname === "/api/stripe/webhook" ||
    pathname.startsWith("/_next/")
  ) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
