# Routing and access

Workspace page dispatch, Supabase sessions, route-level membership checks, and API scoping.

## Entry points

- [src/proxy.ts](../../src/proxy.ts)
- [src/app/w/[workspaceSlug]/[[...path]]/page.tsx](../../src/app/w/%5BworkspaceSlug%5D/%5B%5B...path%5D%5D/page.tsx)
- [src/lib/security-context.ts](../../src/lib/security-context.ts)

## Important exports

- `proxy` — [src/proxy.ts:22](../../src/proxy.ts#L22)
- `WorkspacePathPage` — [src/app/w/[workspaceSlug]/[[...path]]/page.tsx:22](../../src/app/w/%5BworkspaceSlug%5D/%5B%5B...path%5D%5D/page.tsx#L22)
- `getActiveWorkspaceId` — [src/lib/security-context.ts:24](../../src/lib/security-context.ts#L24)
- `requireAuthenticatedUser` — [src/lib/security-context.ts:76](../../src/lib/security-context.ts#L76)

## Relationships

Proxy passes workspace context to route handlers; handlers resolve active membership before Prisma reads or writes.

Frequent cross-module imports: [Data and operations](./data-operations.md), [UI shell](./ui-shell.md), [Service flow](./service-flow.md), [Settings and teams](./settings-teams.md).

## Side effects

Session refresh, redirects, authorization failures, and database-backed membership reads.

Use `npm run codemap -- find <name>`, `refs <name>`, or `deps <name-or-path>` for bounded JSON. Verify source before editing.
