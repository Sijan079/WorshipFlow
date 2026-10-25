# Automation and outputs

Service job requests, status/history, generated-output records, and private downloads.

## Entry points

- [src/app/api/services/[id]/jobs/route.ts](../../src/app/api/services/%5Bid%5D/jobs/route.ts)
- [src/app/api/services/[id]/outputs/[outputId]/download/route.ts](../../src/app/api/services/%5Bid%5D/outputs/%5BoutputId%5D/download/route.ts)
- [src/lib/private-output-storage.ts](../../src/lib/private-output-storage.ts)

## Important exports

- `GET` — [src/app/api/services/[id]/jobs/route.ts:18](../../src/app/api/services/%5Bid%5D/jobs/route.ts#L18)
- `POST` — [src/app/api/services/[id]/jobs/route.ts:35](../../src/app/api/services/%5Bid%5D/jobs/route.ts#L35)

## Relationships

Service job routes persist Prisma jobs and outputs; download routes resolve workspace access and private storage.

Frequent cross-module imports: [Data and operations](./data-operations.md), [Routing and access](./routing-access.md), [Songs and formatter](./songs-formatter.md), [Service flow](./service-flow.md).

## Side effects

Job/output rows and private files are created or read. Inspect the route before assuming a job type has a production worker.

Use `npm run codemap -- find <name>`, `refs <name>`, or `deps <name-or-path>` for bounded JSON. Verify source before editing.
