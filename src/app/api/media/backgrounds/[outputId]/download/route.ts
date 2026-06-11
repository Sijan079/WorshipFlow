import { OutputType } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";
import { readPrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/security-context";

type RouteParams = {
  params: Promise<{ outputId: string }>;
};

function getOutputMimeType(outputJson: unknown) {
  if (!outputJson || typeof outputJson !== "object") {
    return "application/octet-stream";
  }

  const mimeType = (outputJson as { mimeType?: unknown }).mimeType;
  return typeof mimeType === "string" ? mimeType : "application/octet-stream";
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { outputId } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const output = await prisma.generatedOutput.findFirst({
      where: {
        id: outputId,
        type: { in: [OutputType.BACKGROUND_IMAGE, OutputType.BACKGROUND_VIDEO] },
        service: { workspaceId },
      },
      include: { job: true },
    });

    if (!output) {
      return Response.json({ error: "Generated background not found" }, { status: 404 });
    }

    const bytes = await readPrivateOutputFile(output.filePath);
    const fileName = output.filePath.split(/[\\/]/).pop() || "background.bin";

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": getOutputMimeType(output.job?.outputJson),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/media/backgrounds/[outputId]/download error:", error);
    return Response.json(
      { error: getErrorMessage(error, "Failed to download generated background") },
      { status: 500 }
    );
  }
}
