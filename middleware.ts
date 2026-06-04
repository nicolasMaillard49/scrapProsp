import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "prospects-auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Routes ouvertes (page de login + démos publiques + assets statiques)
  if (
    pathname === "/login" ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/demo/") ||
    pathname.startsWith("/d/") ||
    pathname.startsWith("/templates/") ||
    pathname === "/api/sms/incoming" ||
    pathname === "/api/sms/status" ||
    pathname === "/api/cron/run-blasts" ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  const auth = req.cookies.get(COOKIE_NAME);
  if (auth?.value === "ok") {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
