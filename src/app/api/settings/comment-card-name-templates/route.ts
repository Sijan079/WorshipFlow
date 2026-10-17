import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { WorkspaceAuthorizationError, requireExplicitWorkspaceRole } from "@/lib/security-context";
import { ActivateCommentCardNameTemplateSchema, CommentCardNameTemplateSchema } from "@/lib/comment-card-name-templates";

function failed(error: unknown, fallback: string) {
  if (error instanceof WorkspaceAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: getErrorMessage(error, fallback) }, { status: 500 });
}

export async function GET() {
  try {
    const workspaceId = (await requireExplicitWorkspaceRole("MEMBER")).workspaceId;
    const [workspace, templates] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { activeCommentCardNameTemplateId: true } }),
      prisma.commentCardNameTemplate.findMany({ where: { workspaceId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    ]);
    return NextResponse.json(templates.map((template) => ({ ...template, isActive: template.id === workspace.activeCommentCardNameTemplateId })));
  } catch (error: unknown) {
    return failed(error, "Failed to load comment card name templates");
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = (await requireExplicitWorkspaceRole("ADMIN")).workspaceId;
    const parsed = CommentCardNameTemplateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a name of up to 72 characters." }, { status: 400 });
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.commentCardNameTemplate.create({ data: { workspaceId, name: parsed.data.name } });
      await tx.workspace.updateMany({ where: { id: workspaceId, activeCommentCardNameTemplateId: null }, data: { activeCommentCardNameTemplateId: created.id } });
      return created;
    });
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { activeCommentCardNameTemplateId: true } });
    return NextResponse.json({ ...record, isActive: workspace.activeCommentCardNameTemplateId === record.id }, { status: 201 });
  } catch (error: unknown) {
    return failed(error, "Failed to create comment card name template");
  }
}

export async function PATCH(request: Request) {
  try {
    const workspaceId = (await requireExplicitWorkspaceRole("ADMIN")).workspaceId;
    const parsed = ActivateCommentCardNameTemplateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid template." }, { status: 400 });
    const template = await prisma.commentCardNameTemplate.findFirst({ where: { id: parsed.data.id, workspaceId }, select: { id: true } });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    await prisma.workspace.update({ where: { id: workspaceId }, data: { activeCommentCardNameTemplateId: template.id } });
    return NextResponse.json({ id: template.id });
  } catch (error: unknown) {
    return failed(error, "Failed to activate comment card name template");
  }
}
