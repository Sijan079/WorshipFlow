import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanupFormatterDrafts } from "@/features/song-formatter/draft-store";
import { reportRouteFailure } from "@/lib/observability";

export async function POST(request: Request) {
  const secret = process.env.FORMATTER_CLEANUP_SECRET;
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || secret.length < 32) {
    reportRouteFailure(new Error("Formatter cleanup is not configured."), {
      route: "/api/internal/formatter-cleanup",
      method: "POST",
      status: 503,
      request,
      event: "formatter.cleanup.configuration.failure",
    });
    return NextResponse.json({ error: "Cleanup is not configured." }, { status: 503 });
  }
  const supplied = Buffer.from(token); const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    reportRouteFailure(new Error("Formatter cleanup authorization failed."), {
      route: "/api/internal/formatter-cleanup",
      method: "POST",
      status: 401,
      request,
      event: "formatter.cleanup.authorization.failure",
    });
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try { return NextResponse.json({ removed: await cleanupFormatterDrafts() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    reportRouteFailure(error, {
      route: "/api/internal/formatter-cleanup",
      method: "POST",
      status: 503,
      request,
      event: "formatter.cleanup.failure",
    });
    return NextResponse.json({ error: "Cleanup failed." }, { status: 503 });
  }
}
