import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/security-context";
import { consumeTemporaryDownload } from "@/lib/temporary-automation-store";

type RouteParams = {
  params: Promise<{ id: string; jobId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId, jobId } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const job = await prisma.automationJob.findFirst({
      where: { id: jobId, serviceId, service: { workspaceId } },
    });

    if (!job) {
      return Response.json({ error: "Automation job not found" }, { status: 404 });
    }

    const result = await consumeTemporaryDownload(serviceId, jobId);

    if (!result) {
      return Response.json({ error: "This transpose result is no longer available." }, { status: 404 });
    }

    return new Response(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/services/[id]/jobs/[jobId]/download error:", error);
    return Response.json(
      { error: getErrorMessage(error, "Failed to download transpose result") },
      { status: 500 }
    );
  }
}
