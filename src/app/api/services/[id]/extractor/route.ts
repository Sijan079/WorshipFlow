import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { createExtractorJob, processExtractorJob, processImmediateUploadExtractor } from "@/lib/extractor-workflow";
import { JobStatus } from "@prisma/client";
import { LyricsExtractorJobInputSchema } from "@/lib/extractor-types";

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

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const songTitle = String(formData.get("songTitle") ?? "").trim() || undefined;

      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "Choose one DOCX or PDF file." }, { status: 400 });
      }

      const lowerType = file.type.toLowerCase();
      const lowerName = file.name.toLowerCase();
      const isDocx = lowerType.includes("wordprocessingml.document") || lowerName.endsWith(".docx");
      const isPdf = lowerType.includes("pdf") || lowerName.endsWith(".pdf");
      const isTxt = lowerType.includes("text/plain") || lowerName.endsWith(".txt");

      if (!isDocx && !isPdf && !isTxt) {
        return NextResponse.json({ error: "Only DOCX, PDF, and TXT uploads are supported." }, { status: 400 });
      }

      try {
        const { result } = await processImmediateUploadExtractor(serviceId, file, songTitle);
        return NextResponse.json(result);
      } catch (error: unknown) {
        const message = getErrorMessage(error, "Lyrics extraction failed");
        const status = message === "Temporary automation upload is unavailable or expired." ? 410 : 500;
        return NextResponse.json({ error: message }, { status });
      }
    }

    const body = await request.json();
    const parsed = LyricsExtractorJobInputSchema.safeParse(body);

    if (!parsed.success || parsed.data.sourceMode !== "paste") {
      return NextResponse.json({ error: "Paste-mode extractor input is invalid." }, { status: 400 });
    }

    const job = await createExtractorJob(serviceId, parsed.data);

    try {
      const result = await processExtractorJob(serviceId, job.id, parsed.data);
      return NextResponse.json(result);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Lyrics extraction failed");
      const status = message === "Temporary automation upload is unavailable or expired." ? 410 : 500;

      await prisma.automationJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          completedAt: new Date(),
          outputJson: { error: message },
        },
      });

      return NextResponse.json({ error: message }, { status });
    }
  } catch (error: unknown) {
    console.error("POST /api/services/[id]/extractor error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to run lyrics extractor") },
      { status: 500 }
    );
  }
}
