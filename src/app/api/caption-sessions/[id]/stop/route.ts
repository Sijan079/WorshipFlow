import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCaptionAction } from "@/features/sermon-captions/caption-access";
import { retainedCaptionExpiry } from "@/features/sermon-captions/caption-contract";
import { captionErrorResponse, validOperatorToken } from "@/features/sermon-captions/caption-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireCaptionAction("OPERATE");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid caption session." }, { status: 400 });
    const session = await prisma.captionSession.findFirst({ where: { id, workspaceId: context.workspaceId } });
    if (!session) return NextResponse.json({ error: "Caption session not found." }, { status: 404 });
    const isOperator = session.operatorUserId === context.userId && validOperatorToken(request.headers.get("x-caption-operator-token"), session.operatorTokenHash);
    if (!isOperator && context.role === "MEMBER") return NextResponse.json({ error: "Only the operator or a workspace admin can stop this session." }, { status: 403 });
    if (session.status === "ENDED") return NextResponse.json({ stopped: true, expiresAt: session.expiresAt }, { headers: { "Cache-Control": "no-store" } });
    const stoppedAt = new Date();
    const expiresAt = retainedCaptionExpiry(stoppedAt);
    const updated = await prisma.captionSession.updateMany({
      where: { id, status: "LIVE" },
      data: { status: "ENDED", endedAt: stoppedAt, expiresAt },
    });
    if (!updated.count) {
      const current = await prisma.captionSession.findUniqueOrThrow({ where: { id }, select: { expiresAt: true } });
      return NextResponse.json({ stopped: true, expiresAt: current.expiresAt }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ stopped: true, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return captionErrorResponse(error, request, "/api/caption-sessions/[id]/stop", "POST");
  }
}
