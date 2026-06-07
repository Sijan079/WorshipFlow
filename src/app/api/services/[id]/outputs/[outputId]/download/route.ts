import { getErrorMessage } from "@/lib/errors";
import { readPrivateOutputFile } from "@/lib/private-output-storage";
import prisma from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/security-context";

type RouteParams = {
  params: Promise<{ id: string; outputId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId, outputId } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const output = await prisma.generatedOutput.findFirst({
      where: {
        id: outputId,
        serviceId,
        service: { workspaceId },
      },
    });

    if (!output) {
      return Response.json({ error: "Generated output not found" }, { status: 404 });
    }

    const bytes = await readPrivateOutputFile(output.filePath);
    const fileName = output.filePath.split(/[\\/]/).pop() || "output.bin";

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/services/[id]/outputs/[outputId]/download error:", error);
    return Response.json(
      { error: getErrorMessage(error, "Failed to download generated output") },
      { status: 500 }
    );
  }
}
