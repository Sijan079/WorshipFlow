import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { WorkspaceAuthorizationError, requireExplicitWorkspaceRole } from "@/lib/security-context";
import { CommentCardNameTemplateSchema } from "@/lib/comment-card-name-templates";

type RouteParams = { params: Promise<{ id: string }> };

function failed(error: unknown, fallback: string) {
  if (error instanceof WorkspaceAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: getErrorMessage(error, fallback) }, { status: 500 });
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const workspaceId = (await requireExplicitWorkspaceRole("ADMIN")).workspaceId;
    const { id } = await params;
    const parsed = CommentCardNameTemplateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a name of up to 72 characters." }, { status: 400 });
    const result = await prisma.commentCardNameTemplate.updateMany({ where: { id, workspaceId }, data: { name: parsed.data.name } });
    if (!result.count) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json({ id, name: parsed.data.name });
  } catch (error: unknown) {
    return failed(error, "Failed to update comment card name template");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const workspaceId = (await requireExplicitWorkspaceRole("ADMIN")).workspaceId;
    const { id } = await params;
    const removed = await prisma.$transaction(async (tx) => {
      const template = await tx.commentCardNameTemplate.findFirst({ where: { id, workspaceId }, select: { id: true } });
      if (!template) return false;
      const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { activeCommentCardNameTemplateId: true } });
      if (workspace.activeCommentCardNameTemplateId === id) {
        const next = await tx.commentCardNameTemplate.findFirst({ where: { workspaceId, id: { not: id } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
        await tx.workspace.update({ where: { id: workspaceId }, data: { activeCommentCardNameTemplateId: next?.id ?? null } });
      }
      await tx.commentCardNameTemplate.delete({ where: { id, workspaceId } });
      return true;
    });
    if (!removed) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return failed(error, "Failed to delete comment card name template");
  }
}
