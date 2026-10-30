import type { WorkspaceAction } from "@prisma/client";
import { hasModuleAction } from "@/lib/event-access";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";
import type { WorkspaceContext } from "@/lib/workspace-auth";

// Every Site action also needs View: a person who cannot see the pages cannot change them.
export async function requireSiteAction(action: WorkspaceAction) {
  const context = await requireExplicitWorkspaceRole("MEMBER");
  const [canView, canDo] = await Promise.all([
    hasModuleAction(context, "SITE", "VIEW"),
    action === "VIEW" ? Promise.resolve(true) : hasModuleAction(context, "SITE", action),
  ]);
  if (!canView || !canDo) throw new WorkspaceAuthorizationError(403, "You do not have permission for this website action.");
  return context;
}

export function canPublishSite(context: WorkspaceContext) {
  return hasModuleAction(context, "SITE", "PUBLISH");
}
