import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";
import { getDeepgramBalances, type DeepgramBalance } from "@/features/sermon-captions/caption-providers";
import { summarizeCaptionUsage, totalCaptionUsage, usageUtcMonth } from "@/features/sermon-captions/caption-usage";
import { reportRouteFailure } from "@/lib/observability";

const headers = { "Cache-Control": "no-store, private" };

export async function GET(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("ADMIN");
    const now = new Date();
    const [start, end] = usageUtcMonth(now);
    const [days, firstDay, baseline] = await Promise.all([
      prisma.captionUsageDay.findMany({
        where: { workspaceId: context.workspaceId, day: { gte: start, lt: end } },
        select: { day: true, meteredCharacters: true, unmeteredRequests: true },
      }),
      prisma.captionUsageDay.findFirst({
        where: { workspaceId: context.workspaceId }, orderBy: { day: "asc" }, select: { recordedAt: true },
      }),
      prisma.captionUsageBaseline.findUnique({
        where: { workspaceId_month: { workspaceId: context.workspaceId, month: start } },
        select: { characters: true, periodStart: true, capturedAt: true, source: true },
      }),
    ]);
    const appUsage = summarizeCaptionUsage(days, now);
    const azure = {
      ...totalCaptionUsage(baseline?.characters ?? null, appUsage),
      monthStart: start.toISOString(), monthEnd: end.toISOString(),
      trackingSince: firstDay?.recordedAt.toISOString() ?? null,
      baseline: baseline ? {
        periodStart: baseline.periodStart.toISOString(),
        capturedAt: baseline.capturedAt.toISOString(),
        source: baseline.source,
      } : null,
      configured: Boolean(process.env.AZURE_TRANSLATOR_KEY),
      scope: "resource-snapshot-plus-workspace" as const,
    };
    let deepgram: { status: "available" | "unconfigured" | "error"; balances: DeepgramBalance[]; checkedAt: string | null; scope: "project" } = {
      status: "unconfigured", balances: [], checkedAt: null, scope: "project",
    };
    const billingKey = process.env.DEEPGRAM_BILLING_API_KEY;
    const projectId = process.env.DEEPGRAM_PROJECT_ID;
    if (billingKey && projectId) {
      try {
        const balances = await getDeepgramBalances(projectId, billingKey);
        deepgram = { status: "available", balances, checkedAt: new Date().toISOString(), scope: "project" };
      } catch (error) {
        reportRouteFailure(error, { route: "/api/settings/usage/deepgram", method: "GET", status: 502, request });
        deepgram = { status: "error", balances: [], checkedAt: null, scope: "project" };
      }
    }
    return NextResponse.json({ azure, deepgram, checkedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    if (status === 500) reportRouteFailure(error, { route: "/api/settings/usage", method: "GET", status, request });
    return NextResponse.json({ error: status === 500 ? "Could not load caption usage." : (error as Error).message }, { status, headers });
  }
}
