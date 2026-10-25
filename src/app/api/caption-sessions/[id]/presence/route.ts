import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCaptionAction } from "@/features/sermon-captions/caption-access";
import { canReadCaptionSession } from "@/features/sermon-captions/caption-contract";
import { captionErrorResponse, validOperatorToken } from "@/features/sermon-captions/caption-server";

const PresenceInput = z.object({
  state: z.enum(["CONNECTING", "STREAMING", "INTERRUPTED", "ERROR"]),
  sequence: z.number().int().min(1).max(1_000_000),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireCaptionAction("OPERATE");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid caption session." }, { status: 400 });
    const parsed = PresenceInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid connection status." }, { status: 400 });
    const session = await prisma.captionSession.findFirst({
      where: { id, workspaceId: context.workspaceId },
      select: { operatorUserId: true, operatorTokenHash: true, status: true, expiresAt: true },
    });
    if (!session || !canReadCaptionSession(session)) return NextResponse.json({ error: "Caption session is not active." }, { status: 409 });
    if (session.operatorUserId !== context.userId || !validOperatorToken(request.headers.get("x-caption-operator-token"), session.operatorTokenHash)) {
      return NextResponse.json({ error: "Only this session's operator can update caption status." }, { status: 403 });
    }
    const updated = await prisma.captionSession.updateMany({
      where: { id, workspaceId: context.workspaceId, status: "LIVE", expiresAt: { gt: new Date() }, connectionSequence: { lt: parsed.data.sequence } },
      data: { connectionStatus: parsed.data.state, connectionSequence: parsed.data.sequence, lastHeartbeatAt: new Date() },
    });
    return NextResponse.json({ accepted: updated.count === 1 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return captionErrorResponse(error, request, "/api/caption-sessions/[id]/presence", "POST");
  }
}
