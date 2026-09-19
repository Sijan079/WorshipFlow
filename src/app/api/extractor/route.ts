import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { processStandaloneUploadExtractor } from "@/lib/extractor-workflow";
import {
  EXTRACTOR_UPLOAD_TYPES,
  UPLOAD_LIMITS,
  validateDocumentSignature,
  validateUploadFile,
} from "@/lib/upload-security";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";
import { createFormatterDraft, recordFormatterFailure } from "@/features/song-formatter/draft-store";

export async function POST(request: Request) {
  try {
    const scope = await requireExplicitWorkspaceRole("ADMIN");
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
        return NextResponse.json({ error: "Choose one DOCX or PDF file." }, { status: 400 });
      }

      const uploadError = validateUploadFile(file, {
        allowedMimeTypes: EXTRACTOR_UPLOAD_TYPES,
        allowedExtensions: [".docx", ".pdf"],
        maxBytes: UPLOAD_LIMITS.extractorBytes,
      });

      if (uploadError) {
        return NextResponse.json({ error: uploadError }, { status: 400 });
      }

      const signatureError = await validateDocumentSignature(file);
      if (signatureError) {
        return NextResponse.json({ error: signatureError }, { status: 400 });
      }

      try {
        const result = await processStandaloneUploadExtractor(file, songTitle);
        const saved = await createFormatterDraft(scope, { sourceName: file.name, parser: result.outputJson.parser,
          content: { text: result.text, songTitle: songTitle ?? file.name.replace(/\.[^.]+$/, ""), warningCodes: result.outputJson.warningCodes, warningsDismissed: false, directAiReformatUsed: false } });
        return NextResponse.json({ ...result, conversionId: saved.draft!.conversionId });
      } catch (error) {
        await recordFormatterFailure(scope, file.name).catch(() => undefined);
        throw error;
      }
    }

    return NextResponse.json({ error: "Upload one DOCX or PDF file." }, { status: 415 });
  } catch (error: unknown) {    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to run lyrics extractor") },
      { status: error instanceof WorkspaceAuthorizationError ? error.status : 500 }
    );
  }
}
