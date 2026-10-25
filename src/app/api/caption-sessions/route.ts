import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCaptionAction } from "@/features/sermon-captions/caption-access";
import { hasModuleAction } from "@/lib/event-access";
import { retainedCaptionExpiry } from "@/features/sermon-captions/caption-contract";
import { requestDeepgramToken } from "@/features/sermon-captions/caption-providers";
import { CAPTION_SESSION_MS, captionErrorResponse, hashOperatorToken, isUniqueConflict, newOperatorToken } from "@/features/sermon-captions/caption-server";

export async function GET(request: Request) {
  try {
    const context = await requireCaptionAction("VIEW");
    const session = await prisma.captionSession.findFirst({
      where: { workspaceId: context.workspaceId, status: "LIVE", expiresAt: { gt: new Date() } },
      select: { id: true, operatorUserId: true, createdAt: true, expiresAt: true },
    });
    const canOperate = await hasModuleAction(context, "CAPTIONS", "OPERATE");
    return NextResponse.json({ session: session ? { ...session, canManage: context.role !== "MEMBER" } : null, canOperate }, { headers: { "Cache-Control": "no-store" } });
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
    const active = await prisma.captionSession.findFirst({ where: { workspaceId: context.workspaceId, status: "LIVE" }, select: { id: true } });
    if (active) return NextResponse.json({ error: "A caption session is already running in this workspace." }, { status: 409 });
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
