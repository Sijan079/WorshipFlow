# UI shell

Workspace layout, navigation, shared controls, provider setup, and design tokens.

## Entry points

- [src/components/workspace-shell.tsx](../../src/components/workspace-shell.tsx)
- [src/app/w/[workspaceSlug]/layout.tsx](../../src/app/w/%5BworkspaceSlug%5D/layout.tsx)
- [src/components/Providers.tsx](../../src/components/Providers.tsx)

## Important exports

- `WorkspaceShell` — [src/components/workspace-shell.tsx:188](../../src/components/workspace-shell.tsx#L188)
- `Providers` — [src/components/Providers.tsx:7](../../src/components/Providers.tsx#L7)
- `WorkspaceLayout` — [src/app/(workspace)/layout.tsx:3](../../src/app/%28workspace%29/layout.tsx#L3)

## Relationships

Workspace layout wraps page dispatch; shared UI components and token styles shape feature screens.

Frequent cross-module imports: [Data and operations](./data-operations.md), [Media tools](./media-tools.md), [Routing and access](./routing-access.md), [Service flow](./service-flow.md).

## Side effects

Client navigation, query cache setup, and visual state; no domain persistence is owned here.

Use `npm run codemap -- find <name>`, `refs <name>`, or `deps <name-or-path>` for bounded JSON. Verify source before editing.
