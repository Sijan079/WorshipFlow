import { hasModuleAction } from "@/lib/event-access";
import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";
import type { WorkspaceContext } from "@/lib/workspace-auth";
import { canPerformPeopleAction, type PeopleAction, type PeopleGrants } from "./people-access-rules";
import type { PeoplePermissions } from "./person-types";

async function loadGrants(context: WorkspaceContext): Promise<PeopleGrants> {
  const [VIEW, CREATE, EDIT] = await Promise.all([
    hasModuleAction(context, "PEOPLE", "VIEW"),
    hasModuleAction(context, "PEOPLE", "CREATE"),
    hasModuleAction(context, "PEOPLE", "EDIT"),
  ]);
  return { VIEW, CREATE, EDIT };
}

// Ministries follow the PEOPLE module for now.
export async function requirePeopleAction(action: PeopleAction) {
  const context = await requireExplicitWorkspaceRole("MEMBER");
  const grants = await loadGrants(context);
  if (!canPerformPeopleAction(context.role, action, grants)) {
    throw new WorkspaceAuthorizationError(403, "You do not have permission to use People.");
  }
  return { context, permissions: toPermissions(context.role, grants) };
}

function toPermissions(role: string, grants: PeopleGrants): PeoplePermissions {
  return {
    canCreate: canPerformPeopleAction(role, "CREATE", grants),
    canEdit: canPerformPeopleAction(role, "EDIT", grants),
    canDelete: canPerformPeopleAction(role, "DELETE", grants),
  };
}
