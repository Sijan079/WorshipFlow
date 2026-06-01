# Worship Flow OS: Bulletin Ledger Overhaul

## Goal

Completely replace the existing visual design while preserving Worship Flow OS
processes, routes, API behavior, and domain rules. The redesign must feel like a
contemporary church bulletin adapted into a focused preparation workspace:
quiet, clear, human, and efficient for worship tech teams.

This is a visual and interaction overhaul, not a product expansion.

## Preserved Processes

The overhaul keeps these workflows intact:

- Worship service CRUD.
- Strict ordered rendering of worship service blocks.
- Participant assignment.
- Song repository management.
- Adding songs to worship services.
- Song upload, extraction, and formatting.
- Service asset persistence and upload workflows.
- Automation job persistence and generated outputs.
- PAP screenshot transfer, pairing, inbox, and progress states.

The invariant worship block order remains unchanged. The UI must always render
the stored block order and must never introduce alternate sequencing.

## Design Direction

### Genre

Contemporary church bulletin translated into an operational web workspace.

### Macrostructure

Bulletin Ledger.

The application uses a compact top navigation bar instead of a sidebar. Each
page is a full-width work surface with a restrained heading, practical toolbar,
and ledger-like content structure. Dividers, typography, and spacing carry the
bulletin influence. Decorative religious motifs, faux paper textures, and
ornamental flourishes are excluded.

### Visual Character

- Warm-white page background.
- True-white work surfaces.
- Deep forest-green navigation and primary actions.
- Charcoal body text.
- Muted clay accent reserved for secondary emphasis.
- Thin dividers with occasional stronger section rules.
- Small radii and minimal shadows.
- No hero sections, eyebrow labels, floating glass panels, nested cards,
  decorative gradients, or filler copy.

### Typography

- Display and body: Manrope.
- Technical labels, dates, pairing codes, and job identifiers: IBM Plex Mono.
- Headings stay compact and functional.
- Letter spacing remains `0`.
- No oversized dashboard headlines.

### Motion

Motion is quiet and informative:

- 120-180ms opacity fades for newly mounted panels.
- Background and border-color transitions for selected rows and controls.
- Width easing for transfer and job progress.
- A 1px press response for primary actions.
- Visible focus rings appear immediately and never animate.
- `prefers-reduced-motion` collapses movement to short opacity changes.

## Application Shell

Replace the fixed left rail with a compact full-width top bar.

### Desktop

- Left: `Worship Flow` brand wordmark.
- Center: Planner, Services, Songs, Assets, PAP Screenshots, Automation.
- Right: page-relevant compact context control when needed.
- Active navigation uses a dark-green text treatment and a lower border rule,
  not a filled pill.

### Mobile

- Brand remains visible.
- Navigation becomes a horizontally scrollable row beneath the brand line.
- Labels remain single-line.
- No hamburger menu is required for phase 1 because there are six stable
  workflow destinations.

## Page Designs

### Planner

Planner is the canonical Bulletin Ledger page.

- Compact page heading and service selector.
- One narrow readiness strip with factual counts only.
- Strict ordered block rows with sequence number, block name, participant,
  song or asset state, and concise actions.
- Checklist lanes appear beneath the ledger.
- Responsive behavior uses deliberate horizontal overflow for the ledger
  itself while the page remains free of root-level horizontal scrolling.

### Services

Services is an index-and-editor workflow.

- Service index uses flat rows with date, service name, template, and status.
- Create action sits in the page toolbar.
- Selecting a service opens the editor below or in the primary content region.
- Editor sections use bordered field groups and clear labels.
- Destructive actions remain visually separated and restrained.

### Songs

Songs remains a linear content workflow.

- Repository page uses a searchable row-based list.
- Upload, extraction, and formatting retain their current steps.
- Formatting role colors remain available because they encode meaning.
- Pastel role colors are limited to song-formatting contexts.

### Assets

Assets is a practical register.

- Upload action in the toolbar.
- Files shown in rows with service association, type, date, and actions.
- Empty and loading states are direct and minimal.

### Automation

Automation is a job register.

- Jobs appear as rows with type, service, state, output, and timestamp.
- Progress is represented only when active.
- Generated output download remains a clear row action.

### PAP Screenshots

PAP is a transfer desk.

- Desktop surface prioritizes pairing code, QR code, and inbox.
- Mobile sender prioritizes join state, file selection, and transfer progress.
- Toasts are reserved for transfer outcomes and background events.
- QR colors use explicit tokenized hex values for library compatibility.

## Tokens

The old Quiet Sacristy palette is replaced. The implementation will create a
new token set centered on:

- warm-white paper
- true-white surface
- forest-green ink and action
- charcoal text
- muted gray-green secondary text
- clay accent
- red destructive state
- amber warning state
- green success state

All production colors and fonts must use named CSS variables. Song formatting
role colors and QR encoder compatibility colors remain tokenized exceptions.

## Component Boundaries

The implementation should keep the existing feature structure and make
in-place visual edits wherever practical:

- `src/components/workspace-shell.tsx`
- `src/components/worship-service-planner-client.tsx`
- `src/components/service-builder-client.tsx`
- `src/features/pap/components/pap-desktop-client.tsx`
- `src/features/pap/components/pap-mobile-client.tsx`
- `src/features/pap/components/pap-toasts.tsx`
- `src/app/globals.css`
- `tokens.css`
- `DESIGN.md`

Small shared UI helpers may be added only when they remove repeated markup or
clarify ownership. Existing route trees and feature directories must not be
deleted.

## Data Flow And Errors

The overhaul preserves existing data flow. TanStack Query, REST handlers,
Prisma contracts, and shared validation remain untouched unless a visual
integration bug requires a narrow correction.

Errors appear near the affected workflow:

- Field errors remain attached to form controls.
- Failed background actions surface a restrained error message or toast.
- Empty states state what is missing and offer the relevant action.
- No celebratory or decorative success messaging.

## Accessibility And Responsive Rules

- Visible `:focus-visible` rings with sufficient contrast.
- Semantic buttons and links for all interactive controls.
- No root-level horizontal scroll at 320, 375, 414, or 768px widths.
- Clickable text remains single-line.
- Ledger tables use internal horizontal scrolling where necessary.
- Reduced-motion support is mandatory.
- Text wrapping remains contained within its layout region.

## Verification

Implementation verification must include:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`
- Route checks for `/planner`, `/services`, `/songs`, `/assets`, `/pap`, and
  `/automation`
- Desktop and mobile visual inspection
- Core interaction checks for navigation, service selection, ledger rows,
  services editing, songs navigation, PAP pairing, and PAP transfer progress
- Hallmark slop-test review before handoff

## Out Of Scope

- New features or product areas.
- Domain schema changes.
- API redesign.
- Route deletion.
- Authentication work.
- Chat, notifications, recurring events, social features, and generic church
  management features.

