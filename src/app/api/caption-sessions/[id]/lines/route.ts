import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCaptionAction } from "@/features/sermon-captions/caption-access";
import { canReadCaptionSession, normalizeCaptionSource } from "@/features/sermon-captions/caption-contract";
import { createStageTimer, serverTimingHeader } from "@/features/sermon-captions/caption-metrics";
import { translateCaption } from "@/features/sermon-captions/caption-providers";
import { meteredUsageDelta, usageUtcDay } from "@/features/sermon-captions/caption-usage";
import { captionErrorResponse, validOperatorToken } from "@/features/sermon-captions/caption-server";

// `timing` is what the booth measured on its side, sent only so it can be logged next to the server's
// own numbers when looking for where the delay is. It changes nothing.
const LineInput = z.object({
  line: z.number().int().min(1).max(2400),
  source: z.string().min(1).max(300),
  final: z.boolean(),
  timing: z.object({
    recognitionMs: z.number().min(0).max(120_000).optional(),
    previousRoundTripMs: z.number().min(0).max(120_000).optional(),
  }).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const timer = createStageTimer();
  try {
    const context = await requireCaptionAction("OPERATE");
    timer.mark("access");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid caption session." }, { status: 400 });
    const parsed = LineInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid caption line." }, { status: 400 });
    // The database is a round trip away, so calls that do not depend on each other go out together.
    const [session, existing] = await Promise.all([
      prisma.captionSession.findFirst({ where: { id, workspaceId: context.workspaceId } }),
      prisma.captionLine.findUnique({ where: { sessionId_line: { sessionId: id, line: parsed.data.line } } }),
    ]);
    timer.mark("lookup");
    if (!session || !canReadCaptionSession(session)) return NextResponse.json({ error: "Caption session is not active." }, { status: 409 });
    if (session.operatorUserId !== context.userId || !validOperatorToken(request.headers.get("x-caption-operator-token"), session.operatorTokenHash)) {
      return NextResponse.json({ error: "Only this session's operator can publish captions." }, { status: 403 });
    }
    const source = normalizeCaptionSource(parsed.data.source);
    if (!source) return NextResponse.json({ error: "Caption text is empty or too long." }, { status: 400 });
    const chars = source.length;

    // One log line per published caption, only numbers: where the time went on the server, and what the
    // booth measured. Read it in the Vercel logs (search "captions.publish").
    function finish(body: unknown, translated: boolean) {
      const ms = timer.summary();
      console.info(JSON.stringify({
        event: "captions.publish",
        session: id.slice(0, 8),
        line: parsed.data!.line,
        final: parsed.data!.final,
        chars,
        translated,
        ms,
        booth: parsed.data!.timing ?? null,
      }));
      return NextResponse.json(body, { headers: { "Cache-Control": "no-store", "Server-Timing": serverTimingHeader(ms) } });
    }

    if (existing?.final) return finish({ line: existing }, false);
    if (!process.env.AZURE_TRANSLATOR_KEY) return NextResponse.json({ error: "Azure Translator is not configured." }, { status: 503 });
    const translated = existing?.source === source ? null : await translateCaption(source, process.env.AZURE_TRANSLATOR_KEY, process.env.AZURE_TRANSLATOR_REGION);
    timer.mark("translate");
    const english = translated?.english ?? existing!.english;
    const day = usageUtcDay(new Date());
    const [, line] = await Promise.all([
      translated
        ? (() => {
            const delta = meteredUsageDelta(translated.meteredCharacters);
            return prisma.captionUsageDay.upsert({
              where: { workspaceId_day: { workspaceId: context.workspaceId, day } },
              update: { meteredCharacters: { increment: delta.meteredCharacters }, unmeteredRequests: { increment: delta.unmeteredRequests } },
              create: { workspaceId: context.workspaceId, day, ...delta },
            });
          })()
        : Promise.resolve(null),
      prisma.captionLine.upsert({
        where: { sessionId_line: { sessionId: id, line: parsed.data.line } },
        update: { source, english, final: parsed.data.final },
        create: { sessionId: id, line: parsed.data.line, source, english, final: parsed.data.final },
      }),
    ]);
    timer.mark("save");
    const [current] = await Promise.all([
      prisma.captionSession.findUnique({ where: { id }, select: { status: true, expiresAt: true } }),
      prisma.captionLine.deleteMany({ where: { sessionId: id, line: { lte: parsed.data.line - 10 } } }),
    ]);
    timer.mark("verify");
    if (!current || !canReadCaptionSession(current)) {
      await prisma.captionLine.deleteMany({ where: { sessionId: id } });
      return NextResponse.json({ error: "Caption session has ended." }, { status: 409 });
    }
    return finish({ line }, Boolean(translated));
  } catch (error) {
    return captionErrorResponse(error, request, "/api/caption-sessions/[id]/lines", "POST");
  }
}
