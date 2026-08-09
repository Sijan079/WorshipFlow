import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";

type RouteParams = { params: Promise<{ invitationId: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { invitationId } = await params;
    const context = await requireExplicitWorkspaceRole("ADMIN");
    const invitation = await prisma.workspaceInvitation.findFirst({ where: { id: invitationId, workspaceId: context.workspaceId } });
    if (!invitation) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    if (invitation.status !== "PENDING") return NextResponse.json({ error: "Only pending invitations can be revoked." }, { status: 400 });
    await prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { status: "REVOKED" } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    return NextResponse.json({ error: getErrorMessage(error, "Failed to revoke invitation.") }, { status });
  }
}
