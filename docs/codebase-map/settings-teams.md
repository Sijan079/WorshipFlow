# Settings and teams

Workspace templates, presets, checklists, integrations, membership, invitations, and servant roster.

## Entry points

- [src/components/settings-page-client.tsx](../../src/components/settings-page-client.tsx)
- [src/components/teams-page-client.tsx](../../src/components/teams-page-client.tsx)
- [src/app/api/settings/service-templates/route.ts](../../src/app/api/settings/service-templates/route.ts)

## Important exports

- `SettingsPageClient` — [src/components/settings-page-client.tsx:1758](../../src/components/settings-page-client.tsx#L1758)
- `TeamsPageClient` — [src/components/teams-page-client.tsx:323](../../src/components/teams-page-client.tsx#L323)
- `GET` — [src/app/api/members/invitations/route.ts:1](../../src/app/api/members/invitations/route.ts#L1)
- `POST` — [src/app/api/members/invitations/route.ts:1](../../src/app/api/members/invitations/route.ts#L1)

## Relationships

Settings clients call scoped settings APIs; service creation reads saved template blocks and team assignments.

Frequent cross-module imports: [Data and operations](./data-operations.md), [Routing and access](./routing-access.md), [UI shell](./ui-shell.md), [Service flow](./service-flow.md).

## Side effects

Workspace configuration, membership, and servant records change; integration secrets remain server-side.

Use `npm run codemap -- find <name>`, `refs <name>`, or `deps <name-or-path>` for bounded JSON. Verify source before editing.
