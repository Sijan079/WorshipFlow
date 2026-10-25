# Songs and formatter

Song repository, lyrics extraction, editable song document, DOCX output, and temporary draft recovery.

## Entry points

- [src/app/api/songs/route.ts](../../src/app/api/songs/route.ts)
- [src/features/song-formatter/song-document-editor.tsx](../../src/features/song-formatter/song-document-editor.tsx)
- [src/app/api/song-formatter/draft/route.ts](../../src/app/api/song-formatter/draft/route.ts)

## Important exports

- `SongDocumentEditor` — [src/features/song-formatter/song-document-editor.tsx:47](../../src/features/song-formatter/song-document-editor.tsx#L47)
- `GET` — [src/app/api/songs/route.ts:7](../../src/app/api/songs/route.ts#L7)
- `POST` — [src/app/api/songs/route.ts:25](../../src/app/api/songs/route.ts#L25)
- `useServerDraft` — [src/features/song-formatter/use-server-draft.ts:14](../../src/features/song-formatter/use-server-draft.ts#L14)
- `useDraftRecovery` — [src/features/song-formatter/use-draft-recovery.ts:10](../../src/features/song-formatter/use-draft-recovery.ts#L10)

## Relationships

Formatter hooks and editor share document helpers; extraction and draft routes provide server-backed conversion and recovery.

Frequent cross-module imports: [Data and operations](./data-operations.md), [Routing and access](./routing-access.md), [Service flow](./service-flow.md), [UI shell](./ui-shell.md).

## Side effects

Song and draft records may be written; extraction may call an optional AI provider; DOCX downloads are produced.

Use `npm run codemap -- find <name>`, `refs <name>`, or `deps <name-or-path>` for bounded JSON. Verify source before editing.
