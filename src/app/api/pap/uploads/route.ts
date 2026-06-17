import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  PAP_IMAGE_UPLOAD_EXTENSIONS,
  PAP_IMAGE_UPLOAD_TYPES,
  PAP_INBOX_RETENTION_MS,
  PAP_UPLOAD_MAX_FILE_BYTES,
  PAP_UPLOAD_MAX_FILES,
  PAP_UPLOAD_MAX_TOTAL_BYTES,
  PAP_UPLOAD_NOTE_MAX_LENGTH,
} from "@/features/pap/pap-constants";
import { createPAPBatchFileName } from "@/features/pap/rtc/pap-file-names";
import {
  cleanupExpiredPAPInboxUploads,
  sanitizePAPFileName,
} from "@/features/pap/server/pap-inbox";
import { isPAPDatabaseUnavailableError, papDatabaseUnavailableResponse } from "@/features/pap/server/pap-api-errors";
import { savePrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";
import { validateUploadFile, validateUploadTotal } from "@/lib/upload-security";

export const dynamic = "force-dynamic";

type PapInboxScreenshotRow = {
  id: string;
  batchId: string;
  batchIndex: number;
  batchTotal: number;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  note: string | null;
  deviceName: string | null;
  createdAt: Date;
};

function toScreenshotRecord(screenshot: PapInboxScreenshotRow) {
  return {
    id: screenshot.id,
    batchId: screenshot.batchId,
    batchIndex: screenshot.batchIndex,
    batchTotal: screenshot.batchTotal,
    fileName: screenshot.fileName,
    mimeType: screenshot.mimeType,
    size: screenshot.size,
    note: screenshot.note,
    deviceName: screenshot.deviceName,
    createdAt: screenshot.createdAt.toISOString(),
  };
}

export async function GET() {
  try {
    await cleanupExpiredPAPInboxUploads(prisma);
    const screenshots = await prisma.papInboxScreenshot.findMany({
      orderBy: [{ createdAt: "desc" }, { batchIndex: "asc" }],
    });

    return NextResponse.json(
      {
        expiresAfterMs: PAP_INBOX_RETENTION_MS,
        screenshots: screenshots.map(toScreenshotRecord),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("GET /api/pap/uploads error:", error);
    if (isPAPDatabaseUnavailableError(error)) {
      return papDatabaseUnavailableResponse();
    }

    return NextResponse.json({ error: "Failed to load PAP uploads." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await cleanupExpiredPAPInboxUploads(prisma);
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one screenshot is required." }, { status: 400 });
    }

    if (files.length > PAP_UPLOAD_MAX_FILES) {
      return NextResponse.json({ error: `Upload up to ${PAP_UPLOAD_MAX_FILES} screenshots at a time.` }, { status: 400 });
    }

    const totalError = validateUploadTotal(files, PAP_UPLOAD_MAX_TOTAL_BYTES);
    if (totalError) {
      return NextResponse.json({ error: totalError }, { status: 400 });
    }

    for (const file of files) {
      const uploadError = validateUploadFile(file, {
        allowedMimeTypes: PAP_IMAGE_UPLOAD_TYPES,
        allowedExtensions: PAP_IMAGE_UPLOAD_EXTENSIONS,
        maxBytes: PAP_UPLOAD_MAX_FILE_BYTES,
      });

      if (uploadError) {
        return NextResponse.json({ error: uploadError }, { status: 400 });
      }
    }

    const noteValue = String(formData.get("note") ?? "").trim();
    const note = noteValue ? noteValue.slice(0, PAP_UPLOAD_NOTE_MAX_LENGTH) : null;
    const deviceNameValue = String(formData.get("deviceName") ?? "").trim();
    const deviceName = deviceNameValue ? deviceNameValue.slice(0, 120) : null;
    const batchId = randomUUID();
    const batchCreatedAt = new Date();
    const createdScreenshots = [];

    for (const [index, file] of files.entries()) {
      const batchIndex = index + 1;
      const fileName = sanitizePAPFileName(createPAPBatchFileName({ file, batchCreatedAt, batchIndex }));
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mimeType = file.type || "application/octet-stream";
      const savedFile = await savePrivateOutputFile("pap-global-inbox", fileName, bytes, {
        contentType: mimeType,
      });
      const screenshot = await prisma.papInboxScreenshot.create({
        data: {
          id: randomUUID(),
          batchId,
          batchIndex,
          batchTotal: files.length,
          fileName,
          filePath: savedFile.relativePath,
          mimeType,
          size: file.size,
          note,
          deviceName,
        },
      });

      if (!screenshot) {
        throw new Error("PAP upload was not created.");
      }
      createdScreenshots.push(screenshot);
    }

    return NextResponse.json(
      {
        screenshots: createdScreenshots.map(toScreenshotRecord),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("POST /api/pap/uploads error:", error);
    if (isPAPDatabaseUnavailableError(error)) {
      return papDatabaseUnavailableResponse();
    }

    return NextResponse.json({ error: "Failed to upload PAP screenshots." }, { status: 500 });
  }
}
