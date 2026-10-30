import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCaptionAction } from "@/features/sermon-captions/caption-access";
import { canReadCaptionSession } from "@/features/sermon-captions/caption-contract";
import { captionErrorResponse, validOperatorToken } from "@/features/sermon-captions/caption-server";

const PauseInput = z.object({ paused: z.boolean() }).strict();

// Pause keeps the session and the listener link up. Listeners are told "paused" until the operator resumes.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireCaptionAction("OPERATE");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid caption session." }, { status: 400 });
    const parsed = PauseInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid pause request." }, { status: 400 });
    const session = await prisma.captionSession.findFirst({
      where: { id, workspaceId: context.workspaceId },
      select: { operatorUserId: true, operatorTokenHash: true, status: true, expiresAt: true },
    });
    if (!session || !canReadCaptionSession(session)) return NextResponse.json({ error: "Caption session is not active." }, { status: 409 });
    if (session.operatorUserId !== context.userId || !validOperatorToken(request.headers.get("x-caption-operator-token"), session.operatorTokenHash)) {
      return NextResponse.json({ error: "Only this session's operator can pause captions." }, { status: 403 });
    }
    await prisma.captionSession.update({ where: { id }, data: { paused: parsed.data.paused } });
    return NextResponse.json({ paused: parsed.data.paused }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return captionErrorResponse(error, request, "/api/caption-sessions/[id]/pause", "POST");
  }
}
