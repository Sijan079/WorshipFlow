import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";

type RouteParams = { params: Promise<{ id: string; versionId: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id, versionId } = await params;
    const workspaceId = (await requireExplicitWorkspaceRole("ADMIN")).workspaceId;
    const version = await prisma.programBlockTypeVersion.findFirst({
      where: { id: versionId, typeId: id, type: { workspaceId } },
    });
    if (!version) return NextResponse.json({ error: "Program block type version not found" }, { status: 404 });
    const published = await prisma.programBlockTypeVersion.update({
      where: { id: versionId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    return NextResponse.json(published);
  } catch (error: unknown) {
    console.error("POST /api/settings/program-block-types/[id]/versions/[versionId]/publish error:", error);
    return NextResponse.json({ error: getErrorMessage(error, "Failed to publish program block type version") }, { status: 500 });
  }
}
