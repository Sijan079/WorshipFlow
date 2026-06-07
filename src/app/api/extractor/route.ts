import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { LyricsExtractorJobInputSchema } from "@/lib/extractor-types";
import {
  processStandalonePasteExtractor,
  processStandaloneUploadExtractor,
} from "@/lib/extractor-workflow";
import {
  EXTRACTOR_UPLOAD_TYPES,
  UPLOAD_LIMITS,
  validateUploadFile,
} from "@/lib/upload-security";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit({
      key: getRateLimitKey(request, "standalone-extractor"),
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const songTitle = String(formData.get("songTitle") ?? "").trim() || undefined;

      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "Choose one DOCX, PDF, or TXT file." }, { status: 400 });
      }

      const uploadError = validateUploadFile(file, {
        allowedMimeTypes: EXTRACTOR_UPLOAD_TYPES,
        allowedExtensions: [".docx", ".pdf", ".txt"],
        maxBytes: UPLOAD_LIMITS.extractorBytes,
      });

      if (uploadError) {
        return NextResponse.json({ error: uploadError }, { status: 400 });
      }

      const result = await processStandaloneUploadExtractor(file, songTitle);
      return NextResponse.json(result);
    }

    const body = await request.json();
    const parsed = LyricsExtractorJobInputSchema.safeParse(body);

    if (!parsed.success || parsed.data.sourceMode !== "paste") {
      return NextResponse.json({ error: "Paste-mode extractor input is invalid." }, { status: 400 });
    }

    const result = await processStandalonePasteExtractor(parsed.data);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("POST /api/extractor error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to run lyrics extractor") },
      { status: 500 }
    );
  }
}
