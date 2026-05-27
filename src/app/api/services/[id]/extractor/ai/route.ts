import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { LyricsExtractorAiRetryRequestSchema } from "@/lib/extractor-types";
import { processAiRetry } from "@/lib/extractor-workflow";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId } = await params;
    const service = await prisma.worshipService.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = LyricsExtractorAiRetryRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const result = await processAiRetry(serviceId, parsed.data.retryToken);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("POST /api/services/[id]/extractor/ai error:", error);
    const message = getErrorMessage(error, "Failed to run AI lyrics cleanup");
    const status = message.includes("expired") ? 410 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
