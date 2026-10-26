import { hasModuleAction } from "@/lib/event-access";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";
import { canPerformPeopleAction, type PeopleAction } from "./people-access-rules";

// Ministries follow the PEOPLE module for now.
export async function requirePeopleAction(action: PeopleAction) {
  const context = await requireExplicitWorkspaceRole("MEMBER");
  const [view, create, edit] = await Promise.all([
    hasModuleAction(context, "PEOPLE", "VIEW"),
    hasModuleAction(context, "PEOPLE", "CREATE"),
    hasModuleAction(context, "PEOPLE", "EDIT"),
  ]);
  if (!canPerformPeopleAction(context.role, action, { VIEW: view, CREATE: create, EDIT: edit })) {
    throw new WorkspaceAuthorizationError(403, "You do not have permission to use People.");
  }
  return context;
}
