import { cleanupExpiredPAPInboxUploads } from "@/features/pap/server/pap-inbox";
import { readPrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ screenshotId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await cleanupExpiredPAPInboxUploads(prisma);
    const { screenshotId } = await context.params;
    const screenshot = await prisma.papInboxScreenshot.findUnique({
      where: { id: screenshotId },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        mimeType: true,
      },
    });

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
