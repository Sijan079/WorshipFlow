import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCaptionAction } from "@/features/sermon-captions/caption-access";
import { canReadCaptionSession, normalizeCaptionSource } from "@/features/sermon-captions/caption-contract";
import { translateCaption } from "@/features/sermon-captions/caption-providers";
import { meteredUsageDelta, usageUtcDay } from "@/features/sermon-captions/caption-usage";
import { captionErrorResponse, validOperatorToken } from "@/features/sermon-captions/caption-server";

const LineInput = z.object({ line: z.number().int().min(1).max(2400), source: z.string().min(1).max(300), final: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireCaptionAction("OPERATE");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid caption session." }, { status: 400 });
    const parsed = LineInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid caption line." }, { status: 400 });
    const session = await prisma.captionSession.findFirst({ where: { id, workspaceId: context.workspaceId } });
    if (!session || !canReadCaptionSession(session)) return NextResponse.json({ error: "Caption session is not active." }, { status: 409 });
    if (session.operatorUserId !== context.userId || !validOperatorToken(request.headers.get("x-caption-operator-token"), session.operatorTokenHash)) {
      return NextResponse.json({ error: "Only this session's operator can publish captions." }, { status: 403 });
    }
    const source = normalizeCaptionSource(parsed.data.source);
    if (!source) return NextResponse.json({ error: "Caption text is empty or too long." }, { status: 400 });
    const existing = await prisma.captionLine.findUnique({ where: { sessionId_line: { sessionId: id, line: parsed.data.line } } });
    if (existing?.final) return NextResponse.json({ line: existing }, { headers: { "Cache-Control": "no-store" } });
    if (!process.env.AZURE_TRANSLATOR_KEY) return NextResponse.json({ error: "Azure Translator is not configured." }, { status: 503 });
    const translated = existing?.source === source ? null : await translateCaption(source, process.env.AZURE_TRANSLATOR_KEY, process.env.AZURE_TRANSLATOR_REGION);
    if (translated) {
      const day = usageUtcDay(new Date());
      const delta = meteredUsageDelta(translated.meteredCharacters);
      await prisma.captionUsageDay.upsert({
        where: { workspaceId_day: { workspaceId: context.workspaceId, day } },
        update: { meteredCharacters: { increment: delta.meteredCharacters }, unmeteredRequests: { increment: delta.unmeteredRequests } },
        create: { workspaceId: context.workspaceId, day, ...delta },
      });
    }
    const english = translated?.english ?? existing!.english;
    const line = await prisma.captionLine.upsert({
      where: { sessionId_line: { sessionId: id, line: parsed.data.line } },
      update: { source, english, final: parsed.data.final },
      create: { sessionId: id, line: parsed.data.line, source, english, final: parsed.data.final },
    });
    const current = await prisma.captionSession.findUnique({ where: { id }, select: { status: true, expiresAt: true } });
    if (!current || !canReadCaptionSession(current)) {
      await prisma.captionLine.deleteMany({ where: { sessionId: id } });
      return NextResponse.json({ error: "Caption session has ended." }, { status: 409 });
    }
    await prisma.captionLine.deleteMany({ where: { sessionId: id, line: { lte: parsed.data.line - 10 } } });
    return NextResponse.json({ line }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return captionErrorResponse(error, request, "/api/caption-sessions/[id]/lines", "POST");
  }
}
