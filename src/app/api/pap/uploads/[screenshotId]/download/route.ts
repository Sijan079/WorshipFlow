import {
  cleanupExpiredPAPGlobalInboxUploads,
  getOrCreatePAPGlobalInboxRoom,
} from "@/features/pap/server/pap-room-security";
import { readPrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ screenshotId: string }>;
};

type PAPScreenshotDownloadRow = {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await cleanupExpiredPAPGlobalInboxUploads();
    const { screenshotId } = await context.params;
    const room = await getOrCreatePAPGlobalInboxRoom();
    const [screenshot] = await prisma.$queryRaw<PAPScreenshotDownloadRow[]>`
      SELECT "id", "fileName", "filePath", "mimeType"
      FROM "PAPScreenshot"
      WHERE "id" = ${screenshotId}
        AND "roomId" = ${room.id}
      LIMIT 1
    `;

    if (!screenshot) {
      return Response.json({ error: "Screenshot not found." }, { status: 404 });
    }

    const bytes = await readPrivateOutputFile(screenshot.filePath);

    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${screenshot.fileName.replace(/"/g, "")}"`,
        "Content-Type": screenshot.mimeType,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/pap/uploads/[screenshotId]/download error:", error);
    return Response.json({ error: "Failed to download PAP upload." }, { status: 500 });
  }
}
