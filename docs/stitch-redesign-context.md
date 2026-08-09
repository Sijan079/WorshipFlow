# Stitch Redesign Context

This document is the implementation-facing brief for generating an alternate
Worship Flow OS interface in Stitch. It describes the current information
architecture, page behavior, business rules, and layout constraints that carry
meaning. Use it together with:

- [`../DESIGN.md`](../DESIGN.md) for the current visual system and anti-slop rules
- [`laws-of-ux-audit.md`](laws-of-ux-audit.md) for the project's UX knowledge base
- [`../AGENTS.md`](../AGENTS.md) for product, domain, and architecture guardrails

The alternate design may change visual language, composition, navigation
presentation, typography, density, and component styling. It must not change
the domain model, hide required state, reinterpret stored service order, or
invent unimplemented product capabilities.

## Stitch Projects

- Current design: **Worship Production OS** (`13697574181324164099`), using
  **Production Grade Interface**. Keep this project and its screens unchanged.
- Alternate design: **Worship Flow OS - Alternate UI**
  (`15260948165642445938`), private, using the **Rundown Paper** direction.

Initial alternate comparison screens:

- Production Dashboard: `2607be917f2e451099f69ec5e3a42120`
- Worship Services Ledger: `01348d7599954bedaaf0c4c3d401dfc8`
- Service Flow Hub - Rundown Paper: `1ca69ff96f884168bc9fc21f5445bc8b`

## Product Contract

Worship Flow OS prepares one real worship service at a time. It is not a
general church-management, event, scheduling, messaging, or social platform.

The core object is `WorshipService`. A service owns:

- date, ministry, template reference, sermon verse, status, and service variant
- ordered Bible verses
- service-level servant assignments and hymnals
- an ordered snapshot of service blocks
- block-level participants, songs, and details
- assets, automation jobs, and generated outputs

### Non-negotiable service-order rule

1. An operator selects a saved service template when creating a service.
2. The server validates that template and copies all of its blocks into the new
   service inside the creation transaction.
3. Copied blocks receive explicit zero-based `order` values.
4. The created service owns that block snapshot. Later template edits do not
   rewrite existing services.
5. Every service-flow and run-of-service view must render blocks by the stored
   `order`.
6. People and songs inside blocks also render by their stored `order`.
7. A built-in enum may determine behavior, but it must never replace the
   service's visible stored sequence with a global lineup.

For Stitch: block order is data, not decoration. Never regroup, alphabetize, or
reorder blocks to make a composition look balanced. Visual phase grouping may
be added only if the continuous stored sequence remains unmistakable.

## Current Application Frame

### Authentication

`/login` is a temporary workspace-wide access gate, not a user-account screen.
It contains the WorshipFlow brand, a short sign-in explanation, and the access
credential form. Do not show a mock person, avatar, church identity, workspace
switcher, role, or account menu.

### Desktop shell

- Persistent 280px left rail on large screens.
- Brand and current workspace mode at the top.
- Navigation is grouped as Service, Production, and Workspace.
- Media Tools expands to its child tools in the rail.
- Sign out is anchored at the bottom and opens a confirmation dialog.
- Main content is capped at 1540px with 24px desktop horizontal padding.
- A skip link targets the main workspace content.
- Dashboard and Sermon Captions show dismissible in-development notices.

Canonical navigation:

- Dashboard
- Services
- Teams
- Song Formatter
- Media Tools
  - Phone Transfer
  - QR Generator
  - Background Generator
  - Resize Image
- Sermon Captions
- Settings

### Mobile shell

- The persistent rail becomes a top brand/action bar.
- Primary navigation becomes a three-column wrapped grid with practical
  touch targets.
- Media-tool pages add a horizontally scrollable local tool switcher.
- Dense desktop tables collapse metadata into the primary row instead of
  forcing the desktop column grid into a narrow viewport.

Historical alternate design explorations are not part of the runtime product.
The workspace uses the active Production Grade Interface only; routes, state,
data, and actions remain unchanged.

## URL and Screen Map

Only canonical screens should be generated. Redirect aliases do not need their
own designs.

| URL | Current role | Stitch treatment |
| --- | --- | --- |
| `/` | Redirects to `/dashboard` | No separate screen |
| `/login` | Temporary access gate | Generate |
| `/dashboard` | Production orientation and read-only checklist | Generate |
| `/services` | Service register, create, inspect, edit, bulk delete | Generate |
| `/planner` | Redirects to `/dashboard` | No separate screen |
| `/teams` | Servant roster and assignment metadata | Generate |
| `/songs`, `/songs/extraction`, `/songs/library` | Redirect to formatter | No separate screen |
| `/song-formatter/upload` | Formatter upload and processing entry | Generate |
| `/song-formatter/format` | Formatter editor after extraction | Generate as workflow state |
| `/media-tools` | Media tool launcher | Generate |
| `/media-tools/phone-transfer` | Phone-to-booth handoff | Generate |
| `/media-tools/qr-generator` | QR and labeled-card generator | Generate |
| `/media-tools/background-generator` | Validated AI image generation | Generate |
| `/media-tools/resize-image` | Local image preparation and export | Generate |
| `/media-tools/converter` | Redirects to `/media-tools` | No separate screen |
| `/automation` | Service-scoped output queue; in development | Generate with status |
| `/settings` | Workspace configuration collections | Generate |
| `/assets/**` | Redirects to matching Media Tools URLs | No separate screens |
| `/pap` | Standalone compatibility route for Phone Transfer | Reuse Phone Transfer design |

## Screen Contracts

### 1. Production Dashboard

Primary purpose: orient the booth team and get them into the most common
preparation workflows quickly.

Current content:

- Page title and short operational description.
- Four quick actions: Prepare Service, Song Formatter, Phone Transfer, and an
  external Facebook Live link.
- One collapsible pre-service checklist.
- The checklist loads the workspace's active checklist set, filters inactive
  items, and displays active items in stored order.
- The checklist is read-only here. Configuration belongs in Settings.
- Loading, retry, no-active-items, and configured states are explicit.

Layout tied to logic:

- Quick actions are shortcuts, not metrics.
- The checklist is a single ordered reference surface, not a collection of
  cards.
- When no active checklist exists, the recovery action links directly to the
  Checklist settings tab.

Do not generate readiness percentages, completion rings, fake live data, or
editable checklist controls on this page.

### 2. Worship Services

Primary purpose: create and maintain the records that feed the service-flow
workflow.

Register behavior:

- Header with one primary `Add service` action.
- Open ledger with filters for native service date and ministry.
- Refresh and contextual clear-filters actions.
- Multi-select reveals bulk deletion; destructive work requires confirmation.
- Desktop columns: selection, service date/ministry, template, sermon verse,
  status, expand action.
- Mobile rows keep date/ministry primary and fold template, status, and sermon
  verse below it.
- Expanding a row reveals details inline and stays visually connected with one
  accent rule.
- Expanded content toggles between read-only details and an edit form.

Create/edit business logic:

- Date and sermon verse are required.
- A saved service template is required.
- New records default to the next Sunday and `DRAFT`.
- Ministry and template options come from workspace settings.
- First Sunday templates conditionally expose pledge type, pledge reader, and
  Song of Hymns fields. Those values are not valid for regular templates.
- Two offering servants may be entered but cannot be the same normalized name.
- Bible verses preserve explicit list order.
- Service-level servant roles and hymnal roles are structured values.
- Pasted participant text can populate the form.
- Before saving, names not found in Teams trigger an interruption dialog.
  Operators may select which missing names to add to Teams or continue without
  adding them.
- Successful mutations invalidate and reload the service collection.

Layout tied to logic:

- Template selection must precede or stay visibly associated with the fields it
  conditionally controls.
- Conditional First Sunday fields must appear without moving unrelated fields
  unpredictably.
- The unlisted-servants decision must happen after validation and before the
  pending service save completes.
- Editing remains connected to the expanded source row; do not navigate to an
  invented detail page.
- Status needs text plus a visual signal. Color alone is insufficient.

### 3. Teams

Primary purpose: keep a small, reliable servant directory for accurate service
assignment.

Current behavior:

- Header with one primary `Add servant` action.
- Search by servant name and filter by configured servant group.
- Refresh and contextual clear-filters actions.
- Multi-select reveals bulk assign and bulk delete.
- Desktop ledger columns: selection, initials, servant name, gender, group,
  edit action.
- Mobile rows keep name primary and show gender/group as secondary metadata.
- Create/edit dialog manages name, optional gender, and optional group.
- Bulk assignment changes gender and/or group for selected records.
- Names are normalized for display and comparison.

Layout tied to logic:

- Initials help recognition but are not user avatars or identity accounts.
- Search and group filtering belong next to the roster count.
- Repeated row actions align in one predictable column.
- Bulk actions appear only when selection exists.

Do not turn Teams into scheduling, availability, messaging, profiles, roles and
permissions, or social functionality.

### 4. Song Formatter

Primary purpose: turn a PDF or DOCX song source into reviewed, structured
lyrics and export a church-ready DOCX.

Upload state:

- Large file drop/choose target for PDF or DOCX up to 15MB.
- After selection, choose local processing or optional AI processing.
- Immediate selected-file and processing feedback.
- Recent conversions show persisted extraction job history.
- The UI currently lists several aspirational supported outputs, but the
  connected export path is DOCX. The redesign must not present unimplemented
  formats as completed actions.

Editor state:

- Title and status header with AI reformat and Save to Library actions.
- `Save to Library` is currently a placeholder and must read as unavailable or
  future work, not as a successful persistence path.
- Resizable left controls rail and a large lyrics editing canvas.
- Lyrics use explicit tagged sections such as verse, chorus, bridge, and
  repeat tokens.
- Tag definitions and colors come from workspace Song Tag settings.
- Operators can regroup repeated tag sections into two- or three-line groups.
- AI retry may expose confidence warnings; direct AI reformat is limited for a
  draft.
- DOCX export uses the edited song title as its filename basis.

Layout tied to logic:

- Upload and edit are two states of one workflow, not separate products.
- File processing choices appear only after a valid file is selected.
- The editor must keep tag controls and lyrics visible together on desktop.
- Confidence warnings stay near the AI action they qualify.
- The lyrics canvas is the dominant surface; secondary actions must not compete
  with editing.

### 5. Media Tools Home

Primary purpose: choose a concrete media preparation task.

The launcher contains exactly four tools: Phone Transfer, QR Generator,
Background Generator, and Resize Image. These are task entry points, not
dashboard statistics. On desktop the global rail exposes the same tools; on
mobile a local horizontal switcher preserves tool context.

### 6. Phone Transfer

Primary purpose: move worship-service screenshots from a phone to the booth
without degrading the original files.

Current behavior:

- Desktop view combines connection guidance/upload entry and a shared inbox.
- Mobile view prioritizes the screenshot sender.
- Upload accepts screenshot batches with batch position, device name, and
  optional note.
- Inbox polling exposes newly received files.
- Operators can preview, download, and delete individual screenshots.
- Original file quality and filenames are preserved behind secured download
  routes.
- Loading, empty, transfer progress, success, error, and toast feedback are
  visible.

Layout tied to logic:

- Sender and receiver are two device contexts in one handoff.
- The inbox is a chronological operational list, not a gallery feed.
- Preview actions stay attached to the source item.
- Download and delete must remain clearly different actions.

### 7. QR Generator

Primary purpose: create a QR code or labeled service-resource card locally.

Current behavior:

- Presets: worship resource, giving, connect card, livestream, sermon notes,
  and custom.
- Output sizes: slide, print, and social.
- Destination content is required and validated with warning feedback.
- Export mode is either QR-only or labeled card.
- Card mode exposes title and subtitle.
- Foreground and background colors are configurable.
- Live preview shares the same rendering logic as export.
- Actions: copy source, copy PNG, download PNG, and download SVG for QR-only.

Layout tied to logic:

- Settings and preview form a control/result pair.
- Card-only fields stay hidden in QR-only mode.
- Export actions remain unavailable until valid output exists.

### 8. Background Generator

Primary purpose: generate a persisted projection-ready worship background with
cost awareness before provider use.

Workflow:

1. Enter purpose, mood, style, text-safe area, and optional prompt details.
2. Require mood and style before estimate validation.
3. Review provider, model, resolution, estimated cost, and token information.
4. Explicitly generate only after a valid accepted estimate.
5. Preview and download the persisted output or restart.

Recent generated images remain available in a refreshable shelf with preview
and download actions.

Layout tied to logic:

- The three stages are sequential and must show current position and a safe way
  back.
- Estimate review is a trust boundary, not decorative metadata.
- Generate must not appear equivalent to estimate validation.
- Recent outputs are secondary to the active generation workflow.

### 9. Resize Image

Primary purpose: prepare one phone or tablet image for a target presentation
frame entirely in the browser.

Workflow:

1. Source: upload or paste PNG, JPEG, or WebP; replace, clear, and optionally
   detect empty borders.
2. Output frame: use a device preset or custom dimensions; choose orientation,
   fit behavior, crop position, and background behavior as relevant.
3. Export: choose enhancement, format, quality, then download.

The output preview uses the same layout calculations as export. Fill mode
allows direct crop repositioning. Warnings cover distortion, transparency,
upscaling, invalid dimensions, and processing failure.

Layout tied to logic:

- Desktop uses a compact 380px sticky controls panel beside the dominant
  preview.
- Tablet may split control sections into two columns.
- Mobile stacks controls before preview.
- Conditional controls appear only for the selected fit or output mode.
- Final dimensions remain visible near both export and preview.

### 10. Sermon Captions and Output Queue

Status: in development.

Current behavior:

- Uses a selected service as the scope for queued work.
- Accepts a job type and optional JSON input.
- Invalid JSON blocks submission with explicit feedback.
- Persists job history and generated outputs.
- Job states are `QUEUED`, `PROCESSING`, `DONE`, and `FAILED`.
- Completed outputs expose download actions.

The redesign should present this as an operational queue, not a live,
fully-featured caption studio. Do not invent transcript editing, language
controls, live waveform data, notification delivery, or collaboration.

### 11. Settings

Primary purpose: configure the workspace-owned values that directly drive
service preparation.

Tabs:

- General: environment status, ministries, servant groups
- Templates: service templates and ordered block definitions
- Tags: song section tags, tokens, and colors
- Checklist: named checklist sets and their ordered items

Shared collection behavior:

- Each section owns one Add action beside its heading.
- Add reveals a compact creation row below the section header.
- Each section owns one Save action, shown only while that section is dirty.
- Row actions are limited to row-local status, expand, reorder, or delete.
- Default records cannot be deleted where protected by the server.
- Deletion requires confirmation.
- Loading, retry, empty, pending, dirty, success, and error states are explicit.

Template behavior:

- A template has a label, stable code, regular/First Sunday type, optional block
  metadata, and an ordered block list.
- Blocks support drag reorder and keyboard Arrow Up/Down reorder.
- Undo/redo applies to local template edits.
- Saving persists the exact visible order.
- Templates are always active in the current server contract.

Checklist behavior:

- Multiple named sets may exist, but exactly one is selected for dashboard use.
- Sets expand inline.
- Items have label, active state, and explicit order.
- Drag and keyboard reorder update the local draft before section save.
- The active set cannot be treated like a per-service completion tracker.

Song tag behavior:

- Each tag has a label, unique token, and hex color.
- Tags drive parsing and rendering in the Song Formatter editor.

Layout tied to logic:

- Tabs preserve the URL query so a recovery link can open the correct section.
- Dense collections use aligned ledger rows, not nested cards.
- Dirty Save belongs to the section header because changes may span several
  rows.
- Expanded content remains visibly connected to its source record.

## Cross-Screen State Requirements

Every generated screen should account for:

- initial loading or skeleton state
- empty state with the smallest useful recovery action
- filtered-empty state distinct from true-empty state
- hover, focus-visible, selected, expanded, dirty, saving, success, warning,
  destructive confirmation, and error states
- disabled controls with a visible reason when the reason is not obvious
- keyboard operation for tabs, dialogs, forms, lists, and reorder controls
- reduced motion
- touch targets that remain practical in dense layouts

Mutation feedback should be immediate. Optimistic presentation is acceptable
only when failure can be reconciled without losing operator input.

## UX Laws Applied to This Product

Use the full knowledge base in [`laws-of-ux-audit.md`](laws-of-ux-audit.md) as
an audit reference. The following laws are especially tied to current product
behavior:

- **Mental Model:** use service, template, block, servant, song, media, job, and
  output—not generic admin or event-platform terminology.
- **Working Memory:** keep service context, dirty state, conditional template
  rules, final dimensions, and job state visible where decisions happen.
- **Tesler's Law:** the system copies templates, preserves order, normalizes
  input, and handles persistence; the operator still chooses the real ministry,
  people, songs, and production details.
- **Hick's Law:** keep one primary action per page or section and reveal bulk or
  conditional actions only when relevant.
- **Law of Proximity:** validation, row actions, and dependent fields stay next
  to the content they affect.
- **Common Region:** a boundary must represent a real task or context. Avoid
  cards inside cards.
- **Uniform Connectedness:** expanded rows, inline edits, and reorder results
  remain visibly connected to their source.
- **Von Restorff Effect:** reserve strong accents for the active service block,
  live/ready state, or exceptional risk.
- **Fitts's Law:** frequent, urgent, and destructive controls need practical
  targets and predictable placement.
- **Doherty Threshold:** acknowledge uploads, saves, generation, downloads, and
  queueing immediately.
- **Zeigarnik Effect:** preserve visible dirty, pending, incomplete, and failed
  states so work can resume without reconstruction.
- **Peak-End Rule:** make save, export, download, and destructive outcomes
  explicit and trustworthy.

Do not cite a UX law to justify changing stored service order, hiding necessary
validation, inventing progress, or removing accessibility.

## Alternate Design Generation Rules

Generate an alternate interface, not an alternate product.

Keep:

- all canonical routes and domain language
- the current information architecture and action ownership
- stored ordering and conditional field behavior
- real data density and operational states
- current accessibility floor
- one shared application/business-logic implementation

The alternate direction may explore:

- a different semantic palette and type pairing
- a different rail treatment and surface hierarchy
- sharper or softer shape language
- more compact or more spacious density within the documented constraints
- alternate list, inspector, modal, and workflow-step compositions
- light or dark appearance if contrast and pressure-readability remain strong

Reject:

- generic SaaS dashboards
- marketing heroes inside work screens
- fake analytics, readiness scores, activity feeds, or notifications
- ornamental gradients, glow, badge spam, and equal card grids
- mock identities, churches, organizations, roles, or account menus
- duplicated pages or separate business logic for the alternate theme
- layouts that reorder service blocks or separate actions from their source

## Stitch Output Checklist

Before accepting a generated direction, verify:

1. Can the operator identify the current service and next required action?
2. Does every service flow preserve exact stored order?
3. Do template-dependent fields and warnings remain understandable?
4. Are list, expanded, selected, dirty, saving, empty, and error states shown?
5. Are desktop and mobile compositions both specified?
6. Are actions located where their decisions happen?
7. Does the design avoid invented features and fake data?
8. Can the alternate visual layer share the existing routes and business logic?
