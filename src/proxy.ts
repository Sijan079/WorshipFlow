import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthCallbackRecoveryUrl } from "@/lib/auth-redirect";
import { isPublicPathForProxy } from "@/lib/proxy-paths";
import { updateSession } from "@/lib/supabase/proxy";

const LEGACY_WORKSPACE_PATHS = [
  "/dashboard",
  "/services",
  "/teams",
  "/settings",
  "/planner",
  "/songs",
  "/media-tools",
  "/assets",
  "/automation",
  "/pap",
];

export async function proxy(request: NextRequest) {
  const authConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!authConfigured && process.env.NODE_ENV !== "production") return NextResponse.next();
  if (!authConfigured) return new NextResponse("Supabase Auth is not configured.", { status: 503 });

  const authCallbackRecoveryUrl = getAuthCallbackRecoveryUrl(request.url);
  if (authCallbackRecoveryUrl) return NextResponse.redirect(authCallbackRecoveryUrl);

  if (isPublicPathForProxy(request.nextUrl.pathname)) return NextResponse.next();

  if (LEGACY_WORKSPACE_PATHS.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))) {
    return NextResponse.redirect(new URL("/workspaces", request.url));
  }

  const workspaceApiMatch = request.nextUrl.pathname.match(/^\/api\/workspaces\/([^/]+)(\/.*)?$/);
  if (
    request.nextUrl.pathname.startsWith("/api/")
    && !workspaceApiMatch
    && !request.nextUrl.pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.json({ error: "Workspace-scoped API route required." }, { status: 404 });
  }
  const requestHeaders = new Headers(request.headers);
  if (workspaceApiMatch) {
    requestHeaders.set("x-worship-workspace-slug", decodeURIComponent(workspaceApiMatch[1]));
    requestHeaders.set("x-worship-workspace-method", request.method);
  }

  const response = workspaceApiMatch
    ? NextResponse.rewrite(new URL(`/api${workspaceApiMatch[2] || ""}`, request.url), { request: { headers: requestHeaders } })
    : NextResponse.next();
  const session = await updateSession(request, response);

  if (session.authenticated) return session.response;

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
