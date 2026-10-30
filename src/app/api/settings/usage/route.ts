import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";
import { getDeepgramBalances, getDeepgramRequests, type DeepgramBalance } from "@/features/sermon-captions/caption-providers";
import { parseCharacterCap, summarizeCaptionUsage, totalCaptionUsage, usageUtcMonth } from "@/features/sermon-captions/caption-usage";
import type { DeepgramRequest } from "@/features/sermon-captions/usage-buckets";
import { reportRouteFailure } from "@/lib/observability";

const headers = { "Cache-Control": "no-store, private" };

export async function GET(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("ADMIN");
    const now = new Date();
    const [start, end] = usageUtcMonth(now);
    const [days, firstDay, baseline, hours] = await Promise.all([
      prisma.captionUsageDay.findMany({
        where: { workspaceId: context.workspaceId, day: { gte: new Date(start.getTime() - 8 * 86_400_000), lt: end } },
        select: { day: true, meteredCharacters: true, unmeteredRequests: true },
      }),
      prisma.captionUsageDay.findFirst({
        where: { workspaceId: context.workspaceId }, orderBy: { day: "asc" }, select: { recordedAt: true },
      }),
      prisma.captionUsageBaseline.findUnique({
        where: { workspaceId_month: { workspaceId: context.workspaceId, month: start } },
        select: { characters: true, periodStart: true, capturedAt: true, source: true },
      }),
      prisma.captionUsageHour.findMany({
        where: { workspaceId: context.workspaceId, hour: { gte: new Date(now.getTime() - 72 * 3_600_000) } },
        select: { hour: true, meteredCharacters: true },
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
      cap: parseCharacterCap(process.env.CAPTION_MONTHLY_CHARACTER_CAP),
      hourly: hours.map((row) => [row.hour.getTime(), row.meteredCharacters] as [number, number]),
      daily: days.map((row) => ({ day: row.day.toISOString().slice(0, 10), value: row.meteredCharacters })),
      configured: Boolean(process.env.AZURE_TRANSLATOR_KEY),
      scope: "resource-snapshot-plus-workspace" as const,
    };
    let deepgram: { status: "available" | "unconfigured" | "error"; balances: DeepgramBalance[]; checkedAt: string | null; scope: "project"; requests: DeepgramRequest[] } = {
      status: "unconfigured", balances: [], checkedAt: null, scope: "project", requests: [],
    };
    const billingKey = process.env.DEEPGRAM_BILLING_API_KEY;
    const projectId = process.env.DEEPGRAM_PROJECT_ID;
    if (billingKey && projectId) {
      try {
        const balances = await getDeepgramBalances(projectId, billingKey);
        // The streams since a week before the month began, so a week that crosses the month start is whole
        // and any time zone is covered. A failure here only costs the chart; the balance still shows.
        const since = new Date(start.getTime() - 8 * 86_400_000);
        const requests = await getDeepgramRequests(projectId, billingKey, since, now).catch(() => []);
        deepgram = { status: "available", balances, checkedAt: new Date().toISOString(), scope: "project", requests };
      } catch (error) {
        reportRouteFailure(error, { route: "/api/settings/usage/deepgram", method: "GET", status: 502, request });
        deepgram = { status: "error", balances: [], checkedAt: null, scope: "project", requests: [] };
      }
    }
    return NextResponse.json({ azure, deepgram, checkedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    if (status === 500) reportRouteFailure(error, { route: "/api/settings/usage", method: "GET", status, request });
    return NextResponse.json({ error: status === 500 ? "Could not load caption usage." : (error as Error).message }, { status, headers });
  }
}
