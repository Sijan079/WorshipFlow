import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { LyricsExtractorDocxRequestSchema } from "@/lib/extractor-types";
import { sanitizeExtractorFileNameSegment } from "@/lib/extractor-workflow";
import { createLyricsDocx } from "@/lib/lyrics-docx";

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
    const parsed = LyricsExtractorDocxRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const bytes = await createLyricsDocx(parsed.data.text);
    const fileName = `${sanitizeExtractorFileNameSegment(parsed.data.songTitle || "reviewed-song")}-lyrics.docx`;

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("POST /api/services/[id]/extractor/docx error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to generate lyrics DOCX") },
      { status: 500 }
    );
  }
}
