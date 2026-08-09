import { NextResponse } from "next/server";
import { cleanupExpiredPAPInboxUploads } from "@/features/pap/server/pap-inbox";
import { deletePrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/security-context";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ screenshotId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { screenshotId } = await context.params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    await cleanupExpiredPAPInboxUploads(prisma, new Date(), workspaceId);
    const screenshot = await prisma.papInboxScreenshot.findFirst({
      where: { id: screenshotId, workspaceId },
      select: { id: true, filePath: true },
    });

    if (!screenshot) {
      return NextResponse.json({ error: "Screenshot not found." }, { status: 404 });
    }

    await prisma.papInboxScreenshot.delete({
      where: { id: screenshot.id },
    });
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
