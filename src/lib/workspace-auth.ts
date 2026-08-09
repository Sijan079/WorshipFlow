export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
  membershipId: string;
  role: WorkspaceRole;
};

export function canMutateWorkspace(role: WorkspaceRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageMembers(role: WorkspaceRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageMember(actorRole: WorkspaceRole, targetRole: WorkspaceRole) {
  if (!canManageMembers(actorRole) || targetRole === "OWNER") return false;
  return targetRole !== "ADMIN" || actorRole === "OWNER";
}

export function canDeleteWorkspace(role: WorkspaceRole) {
  return role === "OWNER";
}
