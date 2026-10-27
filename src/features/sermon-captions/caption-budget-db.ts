import type { PrismaClient } from "@prisma/client";
import { captionBudget, parseCharacterCap, summarizeCaptionUsage, totalCaptionUsage, usageUtcMonth } from "./caption-usage";

// This month's translated characters for a church against its cap. Includes the Azure export baseline
// when one was recorded, as the Settings usage page does.
export async function workspaceCaptionBudget(prisma: PrismaClient, workspaceId: string, now = new Date()) {
  const [start, end] = usageUtcMonth(now);
  const [days, baseline] = await Promise.all([
    prisma.captionUsageDay.findMany({ where: { workspaceId, day: { gte: start, lt: end } }, select: { day: true, meteredCharacters: true, unmeteredRequests: true } }),
    prisma.captionUsageBaseline.findUnique({ where: { workspaceId_month: { workspaceId, month: start } }, select: { characters: true } }),
  ]);
  const total = totalCaptionUsage(baseline?.characters ?? null, summarizeCaptionUsage(days, now));
  return captionBudget(total.estimatedCharacters, parseCharacterCap(process.env.CAPTION_MONTHLY_CHARACTER_CAP));
}
