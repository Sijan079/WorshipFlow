// Pure rules for who may do what in People. Owner and Admin can do everything;
// a Member needs a grant, and hard delete is never grantable.

export type PeopleAction = "VIEW" | "CREATE" | "EDIT" | "DELETE";
export type PeopleGrants = Record<"VIEW" | "CREATE" | "EDIT", boolean>;

export function canPerformPeopleAction(role: string, action: PeopleAction, grants: PeopleGrants) {
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role !== "MEMBER") return false;
  if (action === "DELETE") return false;
  // Changing the directory requires being able to read it.
  if (!grants.VIEW) return false;
  return grants[action];
}
