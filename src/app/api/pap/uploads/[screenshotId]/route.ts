import { NextResponse } from "next/server";
import {
  cleanupExpiredPAPGlobalInboxUploads,
  getOrCreatePAPGlobalInboxRoom,
} from "@/features/pap/server/pap-room-security";
import { deletePrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ screenshotId: string }>;
};

type PAPScreenshotDeleteRow = {
  id: string;
  filePath: string;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await cleanupExpiredPAPGlobalInboxUploads();
    const { screenshotId } = await context.params;
    const room = await getOrCreatePAPGlobalInboxRoom();
    const [screenshot] = await prisma.$queryRaw<PAPScreenshotDeleteRow[]>`
      SELECT "id", "filePath"
      FROM "PAPScreenshot"
      WHERE "id" = ${screenshotId}
        AND "roomId" = ${room.id}
      LIMIT 1
    `;

    if (!screenshot) {
      return NextResponse.json({ error: "Screenshot not found." }, { status: 404 });
    }

    await prisma.$executeRaw`
      DELETE FROM "PAPScreenshot"
      WHERE "id" = ${screenshot.id}
        AND "roomId" = ${room.id}
    `;
    await deletePrivateOutputFile(screenshot.filePath).catch(() => undefined);

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("DELETE /api/pap/uploads/[screenshotId] error:", error);
    return NextResponse.json({ error: "Failed to delete PAP upload." }, { status: 500 });
  }
}
