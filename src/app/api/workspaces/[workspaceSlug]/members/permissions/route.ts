import { NextResponse } from "next/server";
import { z } from "zod";
import type { WorkspaceAction, WorkspaceModule } from "@prisma/client";
import prisma from "@/lib/prisma";
import { WorkspaceAuthorizationError, requireExplicitWorkspaceRole } from "@/lib/security-context";
import { isConfigurableModuleAction } from "@/lib/module-access";
import { reportRouteFailure } from "@/lib/observability";

const PermissionChange = z.object({
  userId: z.string().uuid().optional(),
  module: z.enum(["EVENTS", "ANNOUNCEMENTS", "CAPTIONS", "PEOPLE"]),
  action: z.enum(["VIEW", "CREATE", "EDIT", "DELETE", "OPERATE", "ATTENDANCE", "DRAFT", "PUBLISH", "SHARE"]),
  enabled: z.boolean(),
});

function errorResponse(error: unknown, request: Request, method: string) {
  const status = error instanceof WorkspaceAuthorizationError ? error.status : 500;
  reportRouteFailure(error, { route: "/api/workspaces/[workspaceSlug]/members/permissions", method, status, request });
  return NextResponse.json({ error: status === 500 ? "Could not update permissions." : (error as Error).message }, { status });
}

export async function GET(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("ADMIN");
    const [defaults, overrides] = await Promise.all([
      prisma.workspaceRoleActionDefault.findMany({ where: { workspaceId: context.workspaceId, role: "MEMBER" }, select: { module: true, action: true } }),
      prisma.workspaceActionGrant.findMany({ where: { workspaceId: context.workspaceId }, select: { userId: true, module: true, action: true, allowed: true } }),
    ]);
    return NextResponse.json({ defaults, overrides });
  } catch (error) {
    return errorResponse(error, request, "GET");
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireExplicitWorkspaceRole("ADMIN");
    const parsed = PermissionChange.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { userId, enabled } = parsed.data;
    const workspaceModule = parsed.data.module as WorkspaceModule;
    const action = parsed.data.action as WorkspaceAction;
    if (!isConfigurableModuleAction(workspaceModule, action)) {
      return NextResponse.json({ error: "This module action is not available yet." }, { status: 400 });
    }

    if (userId) {
      const membership = await prisma.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId: context.workspaceId, userId } },
        select: { role: true },
      });
      if (!membership) throw new WorkspaceAuthorizationError(404, "Workspace member not found.");
      if (membership.role !== "MEMBER") throw new WorkspaceAuthorizationError(403, "Individual permissions apply to Members only.");
      const roleDefault = await prisma.workspaceRoleActionDefault.findUnique({
        where: { workspaceId_role_module_action: { workspaceId: context.workspaceId, role: "MEMBER", module: workspaceModule, action } },
        select: { id: true },
      });
      const where = { workspaceId_userId_module_action: { workspaceId: context.workspaceId, userId, module: workspaceModule, action } };
      if (enabled === Boolean(roleDefault)) {
        await prisma.workspaceActionGrant.deleteMany({ where: where.workspaceId_userId_module_action });
      } else {
        await prisma.workspaceActionGrant.upsert({
          where,
          update: { allowed: enabled, grantedByUserId: context.userId },
          create: { workspaceId: context.workspaceId, userId, module: workspaceModule, action, allowed: enabled, grantedByUserId: context.userId },
        });
      }
    } else {
      const where = { workspaceId_role_module_action: { workspaceId: context.workspaceId, role: "MEMBER" as const, module: workspaceModule, action } };
      if (enabled) {
        await prisma.workspaceRoleActionDefault.upsert({
          where,
          update: {},
          create: { workspaceId: context.workspaceId, role: "MEMBER", module: workspaceModule, action },
        });
      } else {
        await prisma.workspaceRoleActionDefault.deleteMany({ where: where.workspaceId_role_module_action });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, request, "PUT");
  }
}
