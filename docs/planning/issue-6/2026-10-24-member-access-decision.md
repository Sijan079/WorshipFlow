# Member module access decision

**Status:** Implemented for Events View and Create on 2026-10-24.

## Decision

Keep the existing workspace roles `OWNER`, `ADMIN`, and `MEMBER`. Owner and
Admin retain full access. A workspace Admin sets Member defaults for each
implemented module action. An Admin can then allow or block an action for one
Member without changing that default. A personal setting takes precedence over
the Member default. Suspended and removed memberships cannot use either.

The Membership tab is the management surface. Only Owner/Admin can read or
change permission configuration. Members cannot edit their own permissions.
Only Events View and Create are exposed now because these are the only new
module actions enforced by route handlers. Announcements, attendance, editing,
and other planned actions will appear as their APIs are implemented. Legacy
worship preparation modules retain their existing role rules, so older accounts
keep their current access.

## Data and checks

`WorkspaceRoleActionDefault` stores enabled Member actions per workspace.
`WorkspaceActionGrant.allowed` represents an individual allow or block setting;
existing grant rows default to allow during migration. Both are unique by the
relevant workspace, module, and action keys. Event handlers check active
membership first, then resolve Admin/Owner, personal setting, and Member
default in that order. The permission API rejects unimplemented actions and
targets outside the workspace or outside the Member role.

The permission tables are Prisma owned. RLS is enabled in Supabase, with no
browser Data API policies; authenticated route handlers are the access boundary.

## Alternatives

- Replacing roles with individual grants would break older accounts and make
  workspace administration harder. Rejected.
- One Member default with no exceptions would require role proliferation for
  a single volunteer. Rejected.
- A generic matrix covering every existing route would suggest permissions
  are enforced where they are not. Deferred until each module action has a
  defined route and operation boundary.
