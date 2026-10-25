# Current Project State

Last checked against the repository: 2026-10-25. This is a source-level snapshot,
not a claim that every workflow has passed an end-to-end production check.

## Product boundary

Worship Flow is transitioning into church management, beginning with Events.
`WorshipService` still represents one real worship service, while `ChurchEvent`
represents a separate church activity. A workspace represents a church; service,
event, song, settings, media, job, and output records are scoped to it. See
[AGENTS.md](../AGENTS.md) for the governing rules.

## Implemented surfaces

| Area | Current source-level behavior | Start here |
| --- | --- | --- |
| Access and tenancy | Supabase Auth sessions; workspace membership and roles in Prisma; workspace pages at `/w/{workspaceSlug}`; Proxy rewrites workspace API paths and refreshes sessions, while handlers enforce access. | [Architecture](./architecture.md), [`src/proxy.ts`](../src/proxy.ts), [`src/lib/security-context.ts`](../src/lib/security-context.ts) |
| Services | Create and manage services from saved templates; create copies all active template blocks in stored order; service reads order blocks by `order`; people, songs, details, jobs, and outputs have service routes. | [Service flow spec](./specs/service-flow/spec.md), [`src/app/api/services/route.ts`](../src/app/api/services/route.ts), [`src/lib/service-data.ts`](../src/lib/service-data.ts) |
| Events | Calendar-first workspace page and list view; workspace-scoped API lists and creates one-time events with optional external form links. Additive Prisma models reserve later recurrence, attendance, and announcement workflows. Admins can set Member defaults and personal allow/block exceptions for Events View and Create in Membership. The Events and member-access migrations were applied to the configured hosted development database on 2026-10-24. | [Events spec](./specs/events/spec.md), [`src/app/api/events/route.ts`](../src/app/api/events/route.ts), [`prisma/schema.prisma`](../prisma/schema.prisma) |
| Settings and teams | Workspace settings for templates, ministries, servant groups, song tags, checklists, members, invitations, integrations, and comment-card names; servant roster and assignment surface. Owner/Admin can open `?tab=usage` for a dated Azure resource baseline plus later workspace metering, and a live Deepgram project balance. The October 2026 Azure baseline for Angeles City Bible Church is 8,538 characters from the export ending October 25 at 19:54:44 Asia/Manila. Deepgram's balance response does not classify free versus paid credit. | [Settings decisions](./adr/0001-settings-workspace-boundary-and-template-source.md), [usage research](./planning/sermon-captions-usage-settings-viability.md), [`src/components/settings-page-client.tsx`](../src/components/settings-page-client.tsx), [`src/app/api/settings/usage/route.ts`](../src/app/api/settings/usage/route.ts) |
| Songs | Song repository and service assignment routes; lyrics extraction, editable document formatting, DOCX output, and temporary cross-device drafts. | [Song formatter spec](./specs/song-formatter/spec.md), [Song library spec](./specs/song-library/spec.md), [`src/features/song-formatter`](../src/features/song-formatter) |
| Media handoff | Phone transfer, QR generation, image resize, background generation/removal, and comment cards have workspace pages or routes. Generic web conversion is disabled. | [Media tools index](./specs/media-tools/spec.md), [`src/features/pap`](../src/features/pap), [`src/features/media-generation`](../src/features/media-generation) |
| Sermon Captions and outputs | The `/w/{workspaceSlug}/captions` page has Audio setup and Live captions tabs. Audio setup checks a local browser input; Live captions has Start/Stop, Deepgram browser streaming through a temporary token, Azure translation via workspace API, and a per-session text-only receiver. Keep the booth page open in its own tab or window during a broadcast; navigating away in that same tab ends the stream. The viewer shows the latest ten lines newest first, distinguishes connecting, live, temporary interruption, terminal error, and ended states, and retains final lines for one hour after Stop. A booth reconnect preserves the same viewer link; another service creates another link. Anyone with a session link can read it. Captions View and Operate use workspace Member defaults and individual overrides. The page has no service selection or legacy automation-job UI. The former `/automation` path redirects there. The hosted development caption session, permission, connection-state, usage-day, and usage-baseline migrations were applied on 2026-10-25. | [Live outputs spec](./specs/live-outputs/spec.md), [usage-view research](./planning/sermon-captions-usage-settings-viability.md), [`src/features/sermon-captions/sermon-captions-page.tsx`](../src/features/sermon-captions/sermon-captions-page.tsx), [`src/app/api/caption-sessions/route.ts`](../src/app/api/caption-sessions/route.ts) |
| Observability | Structured server failure reporting and OpenTelemetry instrumentation, with a targeted test command. | [`src/lib/observability.ts`](../src/lib/observability.ts), [Deployment notes](./deployment/vercel.md) |

The canonical workspace page dispatch is
[`src/app/w/[workspaceSlug]/[[...path]]/page.tsx`](<../src/app/w/[workspaceSlug]/[[...path]]/page.tsx>).
Some older `src/app/(workspace)` pages and `/assets` paths still exist in source;
check that dispatch and `src/proxy.ts` before treating them as active navigation.

## Data and operational boundaries

- Prisma's [`schema.prisma`](../prisma/schema.prisma) is the persistence contract.
  `ServiceTemplateBlock.order` and `WorshipServiceBlock.order` control their
  respective flows. A service retains its own copied blocks after creation.
- `npm run dev` connects to the configured hosted Supabase development project;
  `npm run dev:docker` starts an isolated local Supabase stack. Neither is a
  substitute for reviewing and applying hosted migrations. See
  [local development](./development/local-dev.md).
- On 2026-10-25, the original PC network accepted TCP to Supabase poolers but
  did not answer PostgreSQL handshake requests, including poolers in other
  regions. Switching to another network restored the connection. Prisma then
  applied `20261025010000_caption_module_permissions` and
  `20261025020000_caption_connection_state`; `prisma migrate status`
  reported the database up to date, and the live caption feed integration
  check passed. If this symptom returns, check the PC's network path before
  changing database credentials or pooler settings.
- The active design contract is [DESIGN.md](../DESIGN.md) with
  [`tokens.css`](../tokens.css) and [`src/app/globals.css`](../src/app/globals.css).

## Status of planning material

[`TODO.md`](../TODO.md) is a follow-up list, not a release plan. The
[mobile usability spec](./specs/mobile-usability/spec.md) is a dated source
audit with proposed work; verify each finding against current code before
implementation.

For a new decision, use the [document map](./map.md), then read the narrow
spec, relevant ADR, and source files. Update this snapshot when the implemented
surface or a major boundary changes.
