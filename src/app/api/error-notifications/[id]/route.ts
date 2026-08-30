import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const context = await requireExplicitWorkspaceRole("MEMBER");
    const { id } = await params;
    const result = await prisma.errorNotification.deleteMany({ where: { id, workspaceId: context.workspaceId, userId: context.userId } });
    if (result.count === 0) return NextResponse.json({ error: "Error notification not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to remove error notification.") }, { status: 500 });
  }
}
