import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deletePrivateOutputFile } from "@/lib/private-output-storage";
import { getActivePAPRoomByToken } from "@/features/pap/server/pap-room-security";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ roomToken: string; screenshotId: string }>;
};

type PAPScreenshotDeleteRow = {
  id: string;
  filePath: string;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { roomToken, screenshotId } = await context.params;
    const room = await getActivePAPRoomByToken(roomToken);
    if (!room) {
      return NextResponse.json({ error: "PAP room is missing or expired." }, { status: 404 });
    }

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
    console.error("DELETE /api/pap/rooms/[roomToken]/screenshots/[screenshotId] error:", error);
    return NextResponse.json({ error: "Failed to delete PAP screenshot." }, { status: 500 });
  }
}
