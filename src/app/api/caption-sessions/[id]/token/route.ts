import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCaptionAction } from "@/features/sermon-captions/caption-access";
import { canReadCaptionSession } from "@/features/sermon-captions/caption-contract";
import { requestDeepgramToken } from "@/features/sermon-captions/caption-providers";
import { captionErrorResponse, validOperatorToken } from "@/features/sermon-captions/caption-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireCaptionAction("OPERATE");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid caption session." }, { status: 400 });
    const session = await prisma.captionSession.findFirst({
      where: { id, workspaceId: context.workspaceId },
      select: { operatorUserId: true, operatorTokenHash: true, status: true, expiresAt: true },
    });
    if (!session || !canReadCaptionSession(session)) return NextResponse.json({ error: "Caption session is not active." }, { status: 409 });
    if (session.operatorUserId !== context.userId || !validOperatorToken(request.headers.get("x-caption-operator-token"), session.operatorTokenHash)) {
      return NextResponse.json({ error: "Only this session's operator can reconnect captions." }, { status: 403 });
    }
    if (!process.env.DEEPGRAM_API_KEY) return NextResponse.json({ error: "Deepgram is not configured." }, { status: 503 });
    const deepgramToken = await requestDeepgramToken(process.env.DEEPGRAM_API_KEY);
    return NextResponse.json({ deepgramToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return captionErrorResponse(error, request, "/api/caption-sessions/[id]/token", "POST");
  }
}
