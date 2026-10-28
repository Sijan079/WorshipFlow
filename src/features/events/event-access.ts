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

// Permanently deleting an event, with all of its dates, is its own permission. Like editing, it also needs
// View: a person who cannot see the calendar cannot remove from it.
export async function requireEventsDelete() {
  const context = await requireExplicitWorkspaceRole("MEMBER");
  const [canView, canDelete] = await Promise.all([
    hasModuleAction(context, "EVENTS", "VIEW"),
    hasModuleAction(context, "EVENTS", "DELETE"),
  ]);
  if (!canView || !canDelete) throw new WorkspaceAuthorizationError(403, "You do not have permission to delete events.");
  return context;
}
