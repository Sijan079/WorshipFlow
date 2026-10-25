# Media tools

Phone transfer, QR, image resize, background creation/removal, and comment-card preparation.

## Entry points

- [src/components/service-builder-client.tsx](../../src/components/service-builder-client.tsx)
- [src/features/pap/server/pap-inbox.ts](../../src/features/pap/server/pap-inbox.ts)
- [src/app/api/media/backgrounds/generate/route.ts](../../src/app/api/media/backgrounds/generate/route.ts)

## Important exports

- `QRGeneratorTool` — [src/components/qr-generator-tool.tsx:112](../../src/components/qr-generator-tool.tsx#L112)
- `ResizeImageTool` — [src/components/resize-image-tool.tsx:211](../../src/components/resize-image-tool.tsx#L211)
- `BackgroundGeneratorTool` — [src/components/background-generator-tool.tsx:74](../../src/components/background-generator-tool.tsx#L74)
- `CommentCardTool` — [src/components/comment-card-tool.tsx:183](../../src/components/comment-card-tool.tsx#L183)

## Relationships

Tool UI calls PAP and media routes; media routes use provider, rate-limit, and private storage helpers.

Frequent cross-module imports: [Data and operations](./data-operations.md), [UI shell](./ui-shell.md), [Routing and access](./routing-access.md), [Automation and outputs](./automation-outputs.md).

## Side effects

Temporary uploads and generated files are stored or downloaded; AI background operations can call a configured provider.

Use `npm run codemap -- find <name>`, `refs <name>`, or `deps <name-or-path>` for bounded JSON. Verify source before editing.
