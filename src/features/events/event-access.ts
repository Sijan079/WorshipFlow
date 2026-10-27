import { hasModuleAction } from "@/lib/event-access";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";

// Changing or cancelling an event, or one of its dates, needs Edit and also View: a person who cannot see
// the calendar cannot change it.
export async function requireEventsEdit() {
  const context = await requireExplicitWorkspaceRole("MEMBER");
  const [canView, canEdit] = await Promise.all([
    hasModuleAction(context, "EVENTS", "VIEW"),
    hasModuleAction(context, "EVENTS", "EDIT"),
  ]);
  if (!canView || !canEdit) throw new WorkspaceAuthorizationError(403, "You do not have permission to change events.");
  return context;
}
