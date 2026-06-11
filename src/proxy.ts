import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_SESSION_COOKIE, verifyAccessSessionCookie } from "@/lib/access-auth";

const PUBLIC_PATH_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/login",
  "/api/auth/login",
  "/api/pap/diagnostics",
  "/api/pap/signaling/",
];

export function proxy(request: NextRequest) {
  const accessPassword = process.env.APP_ACCESS_PASSWORD;

  if (!accessPassword && process.env.VERCEL_ENV === "production") {
    return new NextResponse("Production access gate is not configured.", { status: 503 });
  }

  if (!accessPassword || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (verifyAccessSessionCookie(request.cookies.get(ACCESS_SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}
