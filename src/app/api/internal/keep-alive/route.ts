import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { expiredCaptionSessionFilter } from "@/features/sermon-captions/caption-contract";
import { checkCronAuthorization } from "@/lib/cron-auth";
import { reportRouteFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

// Called once a day by Vercel Cron (see vercel.json). A Supabase Free project is paused after about
// a week of low activity; this one small database write keeps it awake. Writing the current time is
// safe to run twice, since Vercel may deliver a run more than once and never retries a missed one. It
// also erases caption lines the public feed no longer serves, so the one-hour hold is not left to
// chance (Hobby allows one run a day, so "within a day" is the promise).
export async function GET(request: Request) {
  const authorization = checkCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (authorization !== "ok") {
    const status = authorization === "not-configured" ? 503 : 401;
    reportRouteFailure(new Error(`Keep-alive ${authorization}.`), {
      route: "/api/internal/keep-alive",
      method: "GET",
      status,
      request,
      event: `keepalive.${authorization}`,
    });
    return NextResponse.json({ error: status === 503 ? "Keep-alive is not configured." : "Unauthorized." }, { status });
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ lastRunAt: Date }>>`
      INSERT INTO "KeepAlive" ("id", "lastRunAt") VALUES ('singleton', now())
      ON CONFLICT ("id") DO UPDATE SET "lastRunAt" = EXCLUDED."lastRunAt"
      RETURNING "lastRunAt"`;
    const removed = await prisma.captionLine.deleteMany({ where: { session: { is: expiredCaptionSessionFilter(new Date()) } } });
    return NextResponse.json({ ok: true, lastRunAt: rows[0]?.lastRunAt ?? null, captionLinesRemoved: removed.count }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    reportRouteFailure(error, {
      route: "/api/internal/keep-alive",
      method: "GET",
      status: 503,
      request,
      event: "keepalive.failure",
    });
    return NextResponse.json({ error: "Keep-alive failed." }, { status: 503 });
  }
}
