import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCaptionAction } from "@/features/sermon-captions/caption-access";
import { hasModuleAction } from "@/lib/event-access";
import { isTakeoverStale, retainedCaptionExpiry } from "@/features/sermon-captions/caption-contract";
import { isLiveDatabaseInDev } from "@/features/sermon-captions/caption-environment";
import { canRegenerateCaptionLink, canShareCaptionLink } from "@/features/sermon-captions/caption-link";
import { requestDeepgramToken } from "@/features/sermon-captions/caption-providers";
import { CAPTION_SESSION_MS, captionErrorResponse, hashOperatorToken, isUniqueConflict, newOperatorToken } from "@/features/sermon-captions/caption-server";

export async function GET(request: Request) {
  try {
    const context = await requireCaptionAction("VIEW");
    const session = await prisma.captionSession.findFirst({
      where: { workspaceId: context.workspaceId, status: "LIVE", expiresAt: { gt: new Date() } },
      select: { id: true, operatorUserId: true, createdAt: true, expiresAt: true },
    });
    const [canOperate, shareGrant] = await Promise.all([
      hasModuleAction(context, "CAPTIONS", "OPERATE"),
      hasModuleAction(context, "CAPTIONS", "SHARE"),
    ]);
    const canShare = canShareCaptionLink(context.role, { VIEW: true, SHARE: shareGrant });
    return NextResponse.json({
      session: session ? { ...session, canManage: context.role !== "MEMBER" } : null,
      canOperate,
      canShare,
      canRegenerate: canRegenerateCaptionLink(context.role),
      devAgainstLiveDatabase: isLiveDatabaseInDev(process.env.DATABASE_URL, process.env.NODE_ENV),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return captionErrorResponse(error, request, "/api/caption-sessions", "GET");
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireCaptionAction("OPERATE");
    const now = new Date();
    const expired = await prisma.captionSession.findMany({ where: { workspaceId: context.workspaceId, status: "LIVE", expiresAt: { lte: now } }, select: { id: true, expiresAt: true } });
    if (expired.length) {
      await prisma.$transaction(expired.map((item) => prisma.captionSession.updateMany({
        where: { id: item.id, status: "LIVE" },
        data: { status: "ENDED", endedAt: item.expiresAt, expiresAt: retainedCaptionExpiry(item.expiresAt) },
      })));
    }
    await prisma.captionLine.deleteMany({ where: { session: { is: { workspaceId: context.workspaceId, status: "ENDED", expiresAt: { lte: now } } } } });
    const active = await prisma.captionSession.findFirst({ where: { workspaceId: context.workspaceId, status: "LIVE" }, select: { id: true, lastHeartbeatAt: true } });
    if (active && !isTakeoverStale(active.lastHeartbeatAt, now)) {
      return NextResponse.json({ error: "A caption session is already running in this workspace." }, { status: 409 });
    }
    // A session that has sent no heartbeat for two minutes is dead (the booth crashed or lost its
    // connection). End it so the new one can start on the same listener link.
    if (active) {
      await prisma.captionSession.updateMany({
        where: { id: active.id, status: "LIVE" },
        data: { status: "ENDED", endedAt: now, expiresAt: retainedCaptionExpiry(now) },
      });
    }
    if (!process.env.DEEPGRAM_API_KEY || !process.env.AZURE_TRANSLATOR_KEY) {
      return NextResponse.json({ error: "Deepgram and Azure Translator are not configured on this server." }, { status: 503 });
    }
    const deepgramToken = await requestDeepgramToken(process.env.DEEPGRAM_API_KEY);
    const operatorToken = newOperatorToken();
    const session = await prisma.captionSession.create({
      data: {
        workspaceId: context.workspaceId,
        operatorUserId: context.userId,
        operatorTokenHash: hashOperatorToken(operatorToken),
        expiresAt: new Date(now.getTime() + CAPTION_SESSION_MS),
      },
      select: { id: true, createdAt: true, expiresAt: true },
    });
    return NextResponse.json({ session, operatorToken, deepgramToken }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isUniqueConflict(error)) return NextResponse.json({ error: "A caption session is already running in this workspace." }, { status: 409 });
    return captionErrorResponse(error, request, "/api/caption-sessions", "POST");
  }
}
