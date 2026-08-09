import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { requireExplicitWorkspaceRole } from "@/lib/security-context";

const UpdateWorkspaceSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function GET() {
  try {
    const context = await requireExplicitWorkspaceRole("MEMBER");
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: context.workspaceId }, select: { id: true, slug: true, name: true, logoDataUrl: true } });
    return NextResponse.json(workspace);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load workspace settings") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("ADMIN");
    const parsed = UpdateWorkspaceSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    const workspace = await prisma.workspace.update({ where: { id: context.workspaceId }, data: { name: parsed.data.name }, select: { id: true, slug: true, name: true, logoDataUrl: true } });
    return NextResponse.json(workspace);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update workspace settings") }, { status: 500 });
  }
}
