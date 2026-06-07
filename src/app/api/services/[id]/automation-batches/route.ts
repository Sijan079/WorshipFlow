import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { createTemporaryAutomationBatch } from "@/lib/temporary-automation-store";
import {
  EXTRACTOR_UPLOAD_TYPES,
  UPLOAD_LIMITS,
  validateUploadFile,
  validateUploadTotal,
} from "@/lib/upload-security";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { getActiveWorkspaceId, serviceWorkspaceWhere } from "@/lib/security-context";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const rateLimit = checkRateLimit({
      key: getRateLimitKey(request, "automation-batches"),
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const { id: serviceId } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);

    const service = await prisma.worshipService.findUnique({
      where: serviceWorkspaceWhere(serviceId, workspaceId),
    });
    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one upload file is required" }, { status: 400 });
    }

    const batchError = validateUploadTotal(files, UPLOAD_LIMITS.automationBatchTotalBytes);

    if (batchError) {
      return NextResponse.json({ error: batchError }, { status: 400 });
    }

    for (const file of files) {
      const uploadError = validateUploadFile(file, {
        allowedMimeTypes: EXTRACTOR_UPLOAD_TYPES,
        allowedExtensions: [".docx", ".pdf"],
        maxBytes: UPLOAD_LIMITS.automationBatchFileBytes,
      });

      if (uploadError) {
        return NextResponse.json({ error: uploadError }, { status: 400 });
      }
    }

    const batch = await createTemporaryAutomationBatch(serviceId, files);
    return NextResponse.json(batch, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/services/[id]/automation-batches error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to stage automation files") },
      { status: 500 }
    );
  }
}
