import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { WorkspaceAuthorizationError, requireExplicitWorkspaceRole } from "@/lib/security-context";
import { ErrorNotificationSchema } from "@/lib/validation";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof WorkspaceAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: getErrorMessage(error, fallback) }, { status: 500 });
}

export async function GET() {
  try {
    const context = await requireExplicitWorkspaceRole("MEMBER");
    const notifications = await prisma.errorNotification.findMany({
      where: { workspaceId: context.workspaceId, userId: context.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(notifications);
  } catch (error) {
    return errorResponse(error, "Failed to load error notifications.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("MEMBER");
    const parsed = ErrorNotificationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    const notification = await prisma.errorNotification.create({ data: { ...parsed.data, workspaceId: context.workspaceId, userId: context.userId } });
    const overflow = await prisma.errorNotification.findMany({
      where: { workspaceId: context.workspaceId, userId: context.userId },
      orderBy: { createdAt: "desc" },
      skip: 20,
      select: { id: true },
    });
    if (overflow.length) await prisma.errorNotification.deleteMany({ where: { id: { in: overflow.map((item) => item.id) } } });
    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to save error notification.");
  }
}

export async function DELETE() {
  try {
    const context = await requireExplicitWorkspaceRole("MEMBER");
    const result = await prisma.errorNotification.deleteMany({
      where: { workspaceId: context.workspaceId, userId: context.userId },
    });
    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    return errorResponse(error, "Failed to clear error notifications.");
  }
}
