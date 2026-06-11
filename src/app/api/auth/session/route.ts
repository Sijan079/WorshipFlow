import { NextRequest, NextResponse } from "next/server";
import { ACCESS_SESSION_COOKIE, verifyAccessSessionCookie } from "@/lib/access-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    authenticated: verifyAccessSessionCookie(request.cookies.get(ACCESS_SESSION_COOKIE)?.value),
  });
}
