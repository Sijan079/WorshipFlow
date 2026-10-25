# Codebase Knowledge Map

Start here for code navigation. These maps are generated from source and curated module metadata; verify the linked source before a change. [Product and document map](../map.md).

| Module | Responsibility | Map |
| --- | --- | --- |
| Routing and access | Workspace page dispatch, Supabase sessions, route-level membership checks, and API scoping. | [Open](./routing-access.md) |
| Service flow | Service creation, stored template block snapshots, ordered rendering, assignments, and service mutations. | [Open](./service-flow.md) |
| Settings and teams | Workspace templates, presets, checklists, integrations, membership, invitations, and servant roster. | [Open](./settings-teams.md) |
| Songs and formatter | Song repository, lyrics extraction, editable song document, DOCX output, and temporary draft recovery. | [Open](./songs-formatter.md) |
| Media tools | Phone transfer, QR, image resize, background creation/removal, and comment-card preparation. | [Open](./media-tools.md) |
| Automation and outputs | Service job requests, status/history, generated-output records, and private downloads. | [Open](./automation-outputs.md) |
| UI shell | Workspace layout, navigation, shared controls, provider setup, and design tokens. | [Open](./ui-shell.md) |
| Data and operations | Prisma contract, database connection, provisioning, environment checks, instrumentation, and developer scripts. | [Open](./data-operations.md) |

[Architecture diagram](./architecture.mmd) · [Symbol registry](./symbols.json) (query it through the CLI; do not load it all).

## Focused search

`npm run codemap -- find <symbol>` returns matching declarations. `refs <symbol>` finds identifier uses in the defining file and direct importers. `deps <symbol-or-path>` shows indexed imports. Results are JSON, capped at 10 rows, with `total` indicating additional matches. References are a source-based navigation hint, not a type-checked call graph; verify source before edits.

Refresh with `npm run codemap -- update` (or `npm run index:codebase`). Use `npm run index:codebase -- --check` to detect stale output. The script parses only changed source files using SHA-256 values cached in `symbols.json`; unchanged outputs are not rewritten. Tests, declarations, fixtures, generated folders, dependencies, and build output are excluded.
