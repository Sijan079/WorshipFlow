# Data and operations

Prisma contract, database connection, provisioning, environment checks, instrumentation, and developer scripts.

## Entry points

- [prisma/schema.prisma](../../prisma/schema.prisma)
- [src/lib/prisma.ts](../../src/lib/prisma.ts)
- [scripts/dev-hosted.mjs](../../scripts/dev-hosted.mjs)
- [src/instrumentation.ts](../../src/instrumentation.ts)

## Important exports

- `prisma` — [src/lib/prisma.ts:28](../../src/lib/prisma.ts#L28)
- `register` — [src/instrumentation.ts:7](../../src/instrumentation.ts#L7)
- `onRequestError` — [src/instrumentation.ts:23](../../src/instrumentation.ts#L23)

## Relationships

Feature routes use the shared Prisma client; startup scripts validate environment targets before Next starts.

Frequent cross-module imports: [Routing and access](./routing-access.md), [Service flow](./service-flow.md), [Songs and formatter](./songs-formatter.md), [Settings and teams](./settings-teams.md).

## Side effects

Database connections, workspace provisioning, migration operations, and telemetry export.

Use `npm run codemap -- find <name>`, `refs <name>`, or `deps <name-or-path>` for bounded JSON. Verify source before editing.
