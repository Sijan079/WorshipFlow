import { getActivePAPRoomByToken } from "@/features/pap/server/pap-room-security";
import { readPrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ roomToken: string; screenshotId: string }>;
};

type PAPScreenshotDownloadRow = {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { roomToken, screenshotId } = await context.params;
    const room = await getActivePAPRoomByToken(roomToken);
    if (!room) {
      return Response.json({ error: "PAP room is missing or expired." }, { status: 404 });
    }

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
    console.error("GET /api/pap/rooms/[roomToken]/screenshots/[screenshotId]/download error:", error);
    return Response.json({ error: "Failed to download PAP screenshot." }, { status: 500 });
  }
}
