import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";

export async function GET() {
  try {
    const context = await requireExplicitWorkspaceRole("MEMBER");
    const members = await prisma.workspaceMembership.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
    });
    return NextResponse.json({ members, viewerRole: context.role });
  } catch (error: unknown) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Failed to load workspace members.";
    return NextResponse.json({ error: message }, { status });
  }
}
