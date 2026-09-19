import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { processImmediateUploadExtractor } from "@/lib/extractor-workflow";
import {
  EXTRACTOR_UPLOAD_TYPES,
  UPLOAD_LIMITS,
  validateDocumentSignature,
  validateUploadFile,
} from "@/lib/upload-security";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { requireExplicitWorkspaceRole, serviceWorkspaceWhere, WorkspaceAuthorizationError } from "@/lib/security-context";
import { createFormatterDraft, recordFormatterFailure } from "@/features/song-formatter/draft-store";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const rateLimit = checkRateLimit({
      key: getRateLimitKey(request, "extractor"),
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const { id: serviceId } = await params;
    const scope = await requireExplicitWorkspaceRole("ADMIN");
    const workspaceId = scope.workspaceId;

    const service = await prisma.worshipService.findUnique({
      where: serviceWorkspaceWhere(serviceId, workspaceId),
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
        const { result, job } = await processImmediateUploadExtractor(serviceId, file, songTitle);
        const saved = await createFormatterDraft(scope, { sourceName: file.name, parser: result.outputJson.parser, jobId: job.id,
          content: { text: result.text, songTitle: songTitle ?? file.name.replace(/\.[^.]+$/, ""), warningCodes: result.outputJson.warningCodes, warningsDismissed: false, directAiReformatUsed: false } });
        return NextResponse.json({ ...result, conversionId: saved.draft!.conversionId });
      } catch (error: unknown) {
        await recordFormatterFailure(scope, file.name).catch(() => undefined);
        const message = getErrorMessage(error, "Lyrics extraction failed");
        const status = message === "Temporary automation upload is unavailable or expired." ? 410 : 500;
        return NextResponse.json({ error: message }, { status });
      }
    }

    return NextResponse.json({ error: "Upload one DOCX or PDF file." }, { status: 415 });
  } catch (error: unknown) {    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to run lyrics extractor") },
      { status: error instanceof WorkspaceAuthorizationError ? error.status : 500 }
    );
  }
}
