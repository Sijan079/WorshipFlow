import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { deleteTemporaryAutomationBatch } from "@/lib/temporary-automation-store";
import prisma from "@/lib/prisma";
import { getActiveWorkspaceId, serviceWorkspaceWhere } from "@/lib/security-context";

type RouteParams = {
  params: Promise<{ id: string; batchId: string }>;
};

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: serviceId, batchId } = await params;
    const workspaceId = await getActiveWorkspaceId(prisma);
    const service = await prisma.worshipService.findUnique({
      where: serviceWorkspaceWhere(serviceId, workspaceId),
    });

    if (!service) {
      return NextResponse.json({ error: "Worship service not found" }, { status: 404 });
    }

    const removed = await deleteTemporaryAutomationBatch(serviceId, batchId);

    if (!removed) {
      return NextResponse.json({ error: "Temporary automation batch not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Temporary automation batch deleted" });
  } catch (error: unknown) {
    console.error("DELETE /api/services/[id]/automation-batches/[batchId] error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to delete temporary automation batch") },
      { status: 500 }
    );
  }
}
