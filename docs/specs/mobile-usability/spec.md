# Mobile Usability and Reliable Interaction States

Date: 2026-09-20
Status: proposed implementation backlog; audit documented, UI changes not implemented.
Baseline: commit `96e0a1a1`.

## Purpose and boundaries

Help worship-production operators prepare one real service on phone, tablet,
and desktop without losing context, edits, or confidence in save/download results.
Improve responsive task layouts and immediate, truthful feedback, not decorative
animation. Follow [DESIGN.md](../../../DESIGN.md) and the
[UI audit guidance](../../laws-of-ux-audit.md).

This specification records a source-level audit. No authenticated browser/device
audit was performed for this baseline. **C** below means implementation evidence
is confirmed in source; **V** means the layout or interaction consequence needs
browser verification. C does not mean a live failure was reproduced.

Keep existing responsive Services/Teams rows, formatter continuous phone editing,
shared Radix focus handling, semantic tokens, and reduced-motion support.
Always preserve each service's stored block order and workspace authorization.
Do not add Canva, a new design system, general scheduling, or new notification
features. Existing error-history screens are included only for corrective work.

## Page coverage and findings

Workspace paths below are relative to `/w/[workspaceSlug]`. Legacy routes and
redirects are grouped with their destination, not treated as new screens.
Priority: P1 = task correctness/blocker; P2 = friction; P3 = polish.

| ID | Page / area | Priority; evidence | Finding, impact, and smallest correction |
| --- | --- | --- | --- |
| M01 | Shared workspace navigation | P2; C/V | Mobile header and horizontal navigation consume task space; media adds another nav row. Reduce phone chrome and keep active location discoverable without changing destinations. |
| M02 | Dashboard / planner | P2; C | Current-service section is commented out, checklist completion lives only in component state, and query failure falls through to an empty checklist. Restore useful service context and explicit retry; retain session-only wording until persistence is separately approved. |
| M03 | Services list | P1; C | Skeleton condition includes missing data even after failure. Add persistent error/retry; use skeletons only for initial pending load. |
| M04 | Expanded service details | P1; C/V | Grid reserves 2rem + 10rem + 12rem plus gaps/padding at every width. Stack label/value beneath the order number on phones to prevent inaccessible content. |
| M05 | Create/edit service | P1/P2; C/V | Metadata and block values save in separate requests, so failure can leave partial updates. Preserve drafts and disclose partial completion. Long forms and nested parser dialogs need keyboard-open verification and reachable actions. |
| M06 | Teams | P2; C | Refresh replaces loaded rows with skeletons; failed initial load can resemble no matching servants. Preserve rows/selection during refresh and distinguish failure from empty results. |
| M07 | Formatter upload | P2; C/V | Recent-conversion skeletons/resume exist. Verify compact phone spacing and expose a clear retry when recovery fails; do not replace the current workflow. |
| M08 | Formatter editor | P2; C/V | Continuous phone editing exists, but wrapped ribbon groups reduce lyric space. Compact secondary controls and verify caret visibility with virtual keyboard, outline, and shortcut overlay. |
| M09 | Media tools home | P3; C/V | Responsive tool grid exists. Preserve it; validate labels and touch targets after shared navigation work. |
| M10 | Phone Transfer / PAP | P1; C | Batch downloads announce success before promises settle. Upload bytes jump from zero to completion; handled failures still resolve the promise that clears the note. Await outcomes, show partial failure, preserve retry context, and use indeterminate progress unless actual bytes are available. |
| M11 | QR generator | P2; C/V | Stacked settings precede a preview with 520px minimum height. Bring preview and frequent controls closer on phones; verify clipboard failure has a download alternative. |
| M12 | Image resize | P2; C/V | Pointer crop handling exists, but long settings precede preview. Keep frequent controls near preview and verify crop gestures do not interfere with page scrolling. |
| M13 | Background removal | P2; C/V | Layout stacks. Clarify source, processing, result, and download transitions on phones; retain source and retry after failure. |
| M14 | Background generator | P2; C/V | Responsive layouts exist. Distinguish failed history loading from empty history and keep generation/result review compact on phones. |
| M15 | Automation / outputs | P1; C | Service silently defaults to Ladies Ministry or first record while selector sidebar is hidden; download links omit workspace API scope. Require visible service choice/context and workspace-aware URLs. Keep raw-JSON workflow simplification as later product work. |
| M16 | Settings templates/checklists | P1; C/V | Checklist has 34rem minimum width; template editor reserves fixed columns. Drag and keyboard reorder have no explicit tap equivalent. Stack rows and add labeled Move up/down actions. |
| M17 | Settings tags/navigation | P2; C/V | Fixed row columns and full navigation before content squeeze phone editing. Adapt row controls and compact section navigation without hiding unsaved state. |
| M18 | Settings identity/members/integrations | P2; C | Error recovery varies; integration Enabled initializes true rather than from selected provider's saved value. Reflect saved configuration and provide contextual retry without exposing secrets. |
| M19 | Error notifications | P1; C | Missing query data renders No unresolved errors during loading/failure. Separate pending, failed, empty, and populated states. |
| M20 | Login / workspace selection | P3; C/V | Responsive forms and pending feedback exist. Shared login pending flag makes Google sign-in show Sending link on email action. Use operation-specific feedback and verify long workspace names. |
| M21 | Public landing | P3; C | Carousel auto-advances without a pause control and presents design studies as product preview. Add pause/resume; reconcile preview labels with actual content. |
| M22 | Restricted design-system gallery | P3; C/V | Sample ledger retains fixed desktop columns. Add mobile examples after real production patterns are validated. |
| M23 | Shared builder data loading | P2; C | Formatter/media inherit service-list, song-tag, and selected-service queries irrespective of need. Enable queries only for consuming workflows; preserve required formatter tag loading. |

### Source evidence

Paths and symbols refer to the baseline; line numbers may change.

- [Services](../../../src/components/services-page-client.tsx):
  `showTableSkeleton`, `ReadOnlyServiceDetails`, `updateServiceMutation`, create/parser dialogs.
- [Teams](../../../src/components/teams-page-client.tsx): `showListSkeleton` and empty-state branches.
- [Settings](../../../src/components/settings-page-client.tsx):
  `ChecklistSection`, `ServiceTemplateSection`, fixed row grids and mobile tab navigation.
- [Settings administration](../../../src/components/settings-admin-sections.tsx):
  `IntegrationsSection` state initialization and query handling.
- [Shared builder](../../../src/components/service-builder-client.tsx):
  `showServiceSidebar`, `resolvedSelectedServiceId`, automation output anchors and ungated queries.
- [Phone inbox](../../../src/features/pap/components/pap-desktop-client.tsx):
  `downloadBatch`; [sender](../../../src/features/pap/hooks/use-pap-mobile-sender.ts):
  `sendFiles`; [upload panel](../../../src/features/pap/components/pap-upload-panel.tsx):
  `handleFiles` clears note after the resolved promise.
- [Dashboard](../../../src/components/worship-service-planner-client.tsx):
  local completion Set and commented current-service section.
- [Error history](../../../src/components/error-notifications-page.tsx):
  `notificationsQuery.data ?? []` and empty branch.
- [Shell](../../../src/components/workspace-shell.tsx), [dialogs](../../../src/components/ui/dialog.tsx),
  [formatter layout](../../../src/features/song-formatter/song-document-editor.module.css).
- Media tools: [QR](../../../src/components/qr-generator-tool.tsx),
  [resize](../../../src/components/resize-image-tool.tsx),
  [removal](../../../src/components/background-removal-tool.tsx),
  [generation](../../../src/components/background-generator-tool.tsx).
- [Login](../../../src/components/login-form.tsx), [workspace selection](../../../src/components/workspace-selection-client.tsx),
  [carousel](../../../src/components/landing-signal-carousel.tsx),
  [gallery](../../../src/components/design-system-gallery-client.tsx).

## Delivery sequence and behavior contracts

Before implementing each phase, reproduce its source-confirmed failure paths
with controlled responses and verify its V findings in an authenticated local
browser. Record viewport, steps, expected/actual behavior, and screenshots.
If a suspected layout problem does not reproduce, narrow or retire that finding.
Use test data; do not mutate real services merely to audit.

1. **Reliable states (M03, M06, M10, M15, M19):** Distinguish initial pending,
   background refresh, empty, failure, partial success, and success. Keep cached
   content/selection during refresh. Failed operations offer retry and never
   announce success. Queueing requires an explicitly selected service with its
   name/date visible. Workspace output links retain authentication.
2. **Core mobile tasks (M04, M05, M16, M17):** Stack phone detail/editor rows,
   expose tap reorder, and retain user input after errors. Make partial saves
   explicit; do not claim transactional persistence with the existing multi-call
   save. Disable invalid first/last reorder actions and announce the new position.
3. **Navigation/forms (M01, M05, M17):** Compact mobile navigation while keeping
   all destinations reachable. Keep primary actions reachable in long forms with
   the keyboard open. Warn before intentionally discarding dirty edits; do not
   trap users or block a confirmed successful exit.
4. **Formatter/media efficiency (M07-M14, M23):** Keep common touch actions and
   preview near the working content. Preserve formatter selection/undo/export.
   Avoid unrelated data requests. Pause inbox polling when hidden and refresh
   on return; do not cancel an active upload merely because visibility changes.
5. **Lower-priority polish (M02, M18, M20-M22):** Restore truthful dashboard
   context, reflect stored settings, correct pending labels, and improve examples.
   Do not add durable checklist completion without a separate data decision.

### Interfaces, persistence, and observability

Documentation/cleanup introduces no runtime API, schema, or migration changes.
Future responsive changes should retain current REST contracts and membership
checks. Transfer helpers must communicate success/failure to their callers;
batch actions must aggregate outcomes before displaying completion feedback.
Any atomic service-save endpoint or persisted checklist proposal requires a
separate approved contract and appropriate tests before implementation.

Reuse existing failure logging/metrics/traces and client error reporting. Keep
retry errors contextual and avoid duplicate reports per polling cycle. Never put
lyrics, credentials, or arbitrary user content in metric labels. Do not claim a
download was saved to the device merely because a browser download was initiated.

## Acceptance and verification

### P1 regression scenarios

| Findings | Required passing test |
| --- | --- |
| M03, M19 | Initial request fails: show error plus Retry, not endless skeleton/empty success. Retry succeeds without page reload. A failed refresh retains prior data with a nonblocking failure indication. |
| M04 | At 360px and 390px, long block labels/values remain readable with no document-level horizontal scrolling or clipping; displayed sequence equals stored sequence. |
| M05 | Fail one block update after metadata succeeds: retain entered values, disclose incomplete save, and allow retry without falsely declaring all changes saved. Successful retry restores normal saved state. |
| M10 | Fail one batch download: report successes/failures only after requests settle and allow retry of failures. Failed upload retains note/context, exposes retry, and does not display complete or invented byte progress. |
| M15 | With multiple services, no implicit Ladies Ministry/first-record job target. Selected name/date matches the queued service ID. Output downloads use the active workspace; cross-workspace access remains denied. |
| M16 | Touch-only user can edit and move a checklist item/template block both directions at phone widths without drag or hardware keys. Boundaries disable appropriately; saved and reloaded order matches the edit. |

### Cross-page matrix

- Viewports: 360x800, 390x844, 768x1024 tablet, 1440x900 desktop; phone landscape.
- Real mobile browser checks: virtual keyboard open, focus return, sticky actions,
  caret visibility, touch crop/reorder, download/clipboard behavior. Emulation
  alone is not proof of iOS/Android keyboard behavior.
- States: initial load, cached refresh, empty, populated, long labels/content,
  slow network, offline/failure, expired session, partial success, retry.
- Accessibility: keyboard-only path, visible focus, meaningful labels, live status
  announcements, reduced motion, 200% zoom, and practical 40px compact/44px primary
  targets per the existing design contract.
- Guardrails: stored service order, workspace isolation, no dirty-input loss,
  no unrelated requests on formatter/media routes, no full-list flashing on refresh.

For implementation, write a failing focused regression first, then run relevant
unit/integration/browser checks plus lint, TypeScript, and production build.
Ship phases separately. Record browser evidence, skipped checks, known risks,
and telemetry verification per phase. This document is not evidence those
future acceptance tests have passed.
