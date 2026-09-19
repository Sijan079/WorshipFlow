import { NextResponse } from "next/server";
import { reportRouteFailure } from "@/lib/observability";
import { getEnvironmentReport } from "@/lib/server-env";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const env = getEnvironmentReport();
    const { default: prisma } = await import("@/lib/prisma");

    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        ok: true,
        database: "ok",
        environment: env,
        uptimeSeconds: Math.round(process.uptime()),
        latencyMs: Date.now() - startedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    reportRouteFailure(error, {
      route: "/api/health",
      method: "GET",
      status: 503,
      request,
      durationMs: Date.now() - startedAt,
      event: "health.check.failure",
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Health check failed.",
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
