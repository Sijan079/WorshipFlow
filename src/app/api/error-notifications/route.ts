import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";
import { ErrorNotificationSchema } from "@/lib/validation";

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
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load error notifications.") }, { status: 500 });
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
    return NextResponse.json({ error: getErrorMessage(error, "Failed to save error notification.") }, { status: 500 });
  }
}
