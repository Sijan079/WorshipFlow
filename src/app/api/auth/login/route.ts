import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_SESSION_COOKIE,
  ACCESS_SESSION_MAX_AGE_SECONDS,
  createAccessSessionCookie,
  hasValidAccessCredentials,
} from "@/lib/access-auth";

export const dynamic = "force-dynamic";

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > LOGIN_MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  if (!process.env.APP_ACCESS_PASSWORD) {
    return NextResponse.json({ error: "Login is not configured." }, { status: 503 });
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown; user?: unknown } | null;
  const user = typeof body?.user === "string" ? body.user : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!hasValidAccessCredentials(user, password)) {
    return NextResponse.json({ error: "Invalid login." }, { status: 401 });
  }

  loginAttempts.delete(clientKey);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACCESS_SESSION_COOKIE,
    value: createAccessSessionCookie(user || "shared"),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
