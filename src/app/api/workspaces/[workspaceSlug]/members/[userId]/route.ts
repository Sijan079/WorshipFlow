import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";
import { canManageMember } from "@/lib/workspace-auth";

const UpdateMemberSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

type RouteParams = { params: Promise<{ userId: string }> };

async function loadMembership(userId: string) {
  const context = await requireExplicitWorkspaceRole("ADMIN");
  const membership = await prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId: context.workspaceId, userId } },
  });
  if (!membership) throw new WorkspaceAuthorizationError(404, "Workspace member not found.");
  return { context, membership };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const { context, membership } = await loadMembership(userId);
    const parsed = UpdateMemberSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    if (membership.role === "OWNER") {
      return NextResponse.json({ error: "The workspace owner cannot be changed here." }, { status: 400 });
    }
    if (!canManageMember(context.role, membership.role)) {
      return NextResponse.json({ error: "Only the owner can manage an Admin." }, { status: 403 });
    }
    if (parsed.data.role === "ADMIN" && context.role !== "OWNER") {
      return NextResponse.json({ error: "Only the owner can promote a member to Admin." }, { status: 403 });
    }

    const updated = await prisma.workspaceMembership.update({
      where: { id: membership.id },
      data: parsed.data,
      select: { id: true, role: true, status: true, user: { select: { id: true, email: true, displayName: true } } },
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Failed to update workspace member.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const { context, membership } = await loadMembership(userId);
    if (membership.role === "OWNER") {
      return NextResponse.json({ error: "The workspace owner cannot be removed." }, { status: 400 });
    }
    if (!canManageMember(context.role, membership.role)) {
      return NextResponse.json({ error: "Only the owner can remove an Admin." }, { status: 403 });
    }
    if (membership.role === "ADMIN" && context.role !== "OWNER") {
      return NextResponse.json({ error: "Only the owner can remove an Admin." }, { status: 403 });
    }

    await prisma.workspaceMembership.delete({ where: { id: membership.id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Failed to remove workspace member.";
    return NextResponse.json({ error: message }, { status });
  }
}
