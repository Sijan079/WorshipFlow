import { NextResponse } from "next/server";
import { getEnvironmentReport } from "@/lib/server-env";

export async function GET() {
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
    const message = error instanceof Error ? error.message : "Health check failed";

    return NextResponse.json(
      {
        ok: false,
        error: message,
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
