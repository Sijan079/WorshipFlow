import type { WorkspaceAction } from "@prisma/client";
import { hasModuleAction } from "@/lib/event-access";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";
import type { WorkspaceContext } from "@/lib/workspace-auth";

// Every announcement action also needs View: a person who cannot see the page cannot change what is on it.
export async function requireAnnouncementAction(action: WorkspaceAction) {
  const context = await requireExplicitWorkspaceRole("MEMBER");
  const [canView, canDo] = await Promise.all([
    hasModuleAction(context, "ANNOUNCEMENTS", "VIEW"),
    action === "VIEW" ? Promise.resolve(true) : hasModuleAction(context, "ANNOUNCEMENTS", action),
  ]);
  if (!canView || !canDo) throw new WorkspaceAuthorizationError(403, "You do not have permission for this announcement action.");
  return context;
}

export function canPublishAnnouncements(context: WorkspaceContext) {
  return hasModuleAction(context, "ANNOUNCEMENTS", "PUBLISH");
}
