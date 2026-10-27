import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCaptionAction } from "@/features/sermon-captions/caption-access";
import { extendedExpiresAt, extensionWindowOpen } from "@/features/sermon-captions/caption-contract";
import { captionErrorResponse, validOperatorToken } from "@/features/sermon-captions/caption-server";

// Adds four hours to a live session. Only its operator can ask, and only in the last fifteen minutes,
// so a forgotten session still ends on its own.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireCaptionAction("OPERATE");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid caption session." }, { status: 400 });
    const session = await prisma.captionSession.findFirst({
      where: { id, workspaceId: context.workspaceId, status: "LIVE" },
      select: { operatorUserId: true, operatorTokenHash: true, expiresAt: true },
    });
    if (!session) return NextResponse.json({ error: "Caption session is not active." }, { status: 409 });
    if (session.operatorUserId !== context.userId || !validOperatorToken(request.headers.get("x-caption-operator-token"), session.operatorTokenHash)) {
      return NextResponse.json({ error: "Only this session's operator can extend it." }, { status: 403 });
    }
    const now = new Date();
    if (!extensionWindowOpen(session.expiresAt, now)) {
      return NextResponse.json({ error: "Captions can be extended in the last 15 minutes." }, { status: 409 });
    }
    const expiresAt = extendedExpiresAt(session.expiresAt);
    // The old expiry is part of the condition, so two clicks add four hours once.
    const updated = await prisma.captionSession.updateMany({
      where: { id, workspaceId: context.workspaceId, status: "LIVE", expiresAt: session.expiresAt },
      data: { expiresAt },
    });
    if (!updated.count) return NextResponse.json({ error: "Caption session changed. Try again." }, { status: 409 });
    return NextResponse.json({ expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return captionErrorResponse(error, request, "/api/caption-sessions/[id]/extend", "POST");
  }
}
