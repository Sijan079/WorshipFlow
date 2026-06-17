import { NextResponse } from "next/server";
import { cleanupExpiredPAPInboxUploads } from "@/features/pap/server/pap-inbox";
import { deletePrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ screenshotId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await cleanupExpiredPAPInboxUploads(prisma);
    const { screenshotId } = await context.params;
    const screenshot = await prisma.papInboxScreenshot.findUnique({
      where: { id: screenshotId },
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
