import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = [
  "/_next",
  "/favicon.ico",
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

  const authorization = request.headers.get("authorization");
  if (hasValidBasicAuth(authorization, accessPassword, process.env.APP_ACCESS_USER)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="WorshipFlow", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function hasValidBasicAuth(
  authorization: string | null,
  expectedPassword: string,
  expectedUser?: string
) {
  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const user = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : "";
    const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : decoded;

    return password === expectedPassword && (!expectedUser || user === expectedUser);
  } catch {
    return false;
  }
}
