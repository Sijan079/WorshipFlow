# Service flow

Service creation, stored template block snapshots, ordered rendering, assignments, and service mutations.

## Entry points

- [src/app/api/services/route.ts](../../src/app/api/services/route.ts)
- [src/app/api/services/[id]/route.ts](../../src/app/api/services/%5Bid%5D/route.ts)
- [src/components/services-page-client.tsx](../../src/components/services-page-client.tsx)

## Important exports

- `GET` — [src/app/api/services/route.ts:19](../../src/app/api/services/route.ts#L19)
- `POST` — [src/app/api/services/route.ts:62](../../src/app/api/services/route.ts#L62)
- `serviceDetailInclude` — [src/lib/service-data.ts:72](../../src/lib/service-data.ts#L72)
- `normalizeServiceBlockInputs` — [src/lib/service-blocks.ts:12](../../src/lib/service-blocks.ts#L12)
- `getServiceBlockOrder` — [src/lib/service-data.ts:2](../../src/lib/service-data.ts#L2)
- `getServiceBlockOrder` — [src/lib/service-display.ts:36](../../src/lib/service-display.ts#L36)

## Relationships

Service routes use shared validation and Prisma; UI consumes ordered service payloads. Template blocks are copied at creation.

Frequent cross-module imports: [Data and operations](./data-operations.md), [Routing and access](./routing-access.md), [Songs and formatter](./songs-formatter.md), [Settings and teams](./settings-teams.md).

## Side effects

Service, block, participant, song, and detail records are persisted. Stored block order is the display order.

Use `npm run codemap -- find <name>`, `refs <name>`, or `deps <name-or-path>` for bounded JSON. Verify source before editing.
