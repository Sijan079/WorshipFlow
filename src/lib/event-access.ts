import type { WorkspaceAction, WorkspaceModule } from "@prisma/client";
import prisma from "@/lib/prisma";
import { WorkspaceAuthorizationError, requireExplicitWorkspaceRole } from "@/lib/security-context";
import type { WorkspaceContext } from "@/lib/workspace-auth";
import { resolveModuleAction } from "@/lib/module-access";

export async function hasModuleAction(context: WorkspaceContext, module: WorkspaceModule, action: WorkspaceAction) {
  if (context.role === "OWNER" || context.role === "ADMIN") return true;

  const [grant, roleDefault] = await Promise.all([prisma.workspaceActionGrant.findUnique({
    where: {
      workspaceId_userId_module_action: {
        workspaceId: context.workspaceId,
        userId: context.userId,
        module,
        action,
      },
    },
    select: { allowed: true },
  }), prisma.workspaceRoleActionDefault.findUnique({
    where: { workspaceId_role_module_action: { workspaceId: context.workspaceId, role: "MEMBER", module, action } },
    select: { id: true },
  })]);
  return resolveModuleAction(context.role, Boolean(roleDefault), grant?.allowed ?? null);
}

export const hasEventAction = hasModuleAction;

export async function requireEventAction(module: WorkspaceModule, action: WorkspaceAction) {
  const context = await requireExplicitWorkspaceRole("MEMBER");
  if (!(await hasModuleAction(context, module, action))) {
    throw new WorkspaceAuthorizationError(403, "You do not have permission for this event action.");
  }
  return context;
}
