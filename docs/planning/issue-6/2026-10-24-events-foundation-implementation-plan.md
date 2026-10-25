# Events Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a workspace-scoped Events foundation with an additive migration and a calendar-first Events page.

**Architecture:** `ChurchEvent` owns event metadata, dated occurrences own calendar placement, and separate action grants allow narrowly authorized member actions. A workspace-scoped REST handler serves the interactive client page. The existing shell gains one Events link; worship service data remains separate.

**Tech Stack:** Prisma/PostgreSQL, Next.js 16 App Router, React 19, TanStack Query, Zod, Tailwind CSS.

**Spec:** [Events foundation design](./2026-10-24-events-foundation-design.md)

## Global Constraints

- Month calendar is the default Events view; List is secondary and Week is deferred.
- No public event page or hosted registration form.
- Do not change `WorshipService` or stored service block order.
- Owner/Admin administer grants; a member's event write must require an explicit action grant.
- Registration and attendance remain optional.
- No hosted database migration apply in this plan.

## Review Focus

- A member from another workspace cannot read or create an event.
- A member without `events.create` cannot create an event through the API.
- Month boundaries display occurrences in the correct cells.
- Overlap is advisory and never blocks a valid event save.
- An empty workspace renders a truthful calendar without fabricated event records.

---

### Task 1: Additive event persistence

**Files:** Modify `prisma/schema.prisma`; create `prisma/migrations-current/<timestamp>_events_foundation/migration.sql`.

**Interfaces:** Produces `ChurchEvent`, `ChurchEventOccurrence`, `EventVisitor`, `EventAnnouncement`, and `WorkspaceActionGrant` Prisma models with workspace-scoped relations and indexes.

- [ ] Define the schema additions from the design, leaving existing service tables untouched.
- [ ] Generate and inspect an additive SQL migration with Prisma's schema diff tooling.
- [ ] Run `npx prisma validate` and `npx prisma generate`; expect exit 0.
- [ ] Verify the migration SQL contains only additive statements and no `WorshipService`/block alteration.

### Task 2: Authorized event API and calendar behavior

**Files:** Create `src/features/events/event-validation.ts`, `src/features/events/calendar.ts`, `src/features/events/calendar.test.ts`, `src/app/api/events/route.ts`, `src/lib/event-access.ts`.

**Interfaces:** `GET /api/workspaces/{slug}/events?from=&to=` returns occurrence summaries and `canCreate`; `POST` creates one event and its initial occurrence. `getMonthCells(year, month)` maps dates to a Monday-first calendar. `requireEventAction(workspaceSlug, action)` returns workspace context or throws 403.

- [ ] Write a failing test for month-cell placement and boundaries; run it and see the expected assertion fail.
- [ ] Implement the calendar helper; run the test and expect pass.
- [ ] Write a failing authorization check for a member without an explicit grant; run it and see the expected denial fail.
- [ ] Implement exact workspace/action authorization, Zod input validation, list and create handlers; rerun targeted checks.
- [ ] Verify GET only returns records in the requested workspace and time window; POST accepts overlap and creates no worship-service records.

### Task 3: Calendar-first workspace screen

**Files:** Create `src/features/events/events-page-client.tsx`; modify `src/app/w/[workspaceSlug]/[[...path]]/page.tsx`, `src/components/workspace-shell.tsx`, and applicable scoped styles.

**Interfaces:** `/w/{workspaceSlug}/events` is a real, interactive month calendar backed by the Events API. New Event creates a one-time occurrence; selecting a date or event opens compact details. List is a secondary view.

- [ ] Write a failing calendar grouping check for an event's local date, then verify failure.
- [ ] Build the calendar using current semantic workspace tokens and accessible controls; make the empty state truthful.
- [ ] Add the route dispatch and shell nav entry; verify keyboard focus, narrow-screen agenda, loading/error states, and permission-aware Create action.
- [ ] Run targeted tests, `npm test`, `npx tsc --noEmit`, and lint for changed files; expect exit 0.
- [ ] Run `npm run codemap -- update` and refresh scope/architecture/current-state docs to record the approved Events boundary.

## Deferred slices

Weekly occurrence generation/edit exceptions, social account connection and publishing, form template creation, response count synchronization, visitor names, and attendance entry require dedicated behavior and provider plans. Their schema foundations may exist, but the UI must not imply those capabilities work in this first screen.

## Implementation outcome

The additive migration was applied to the configured hosted development database on 2026-10-24, and Prisma reported the schema up to date afterward. The calendar page, list view, event create form, scoped API, and exact action grant check are implemented. Calendar, access, and validation tests were observed failing before implementation and passing after it. `npm test`, migration-order check, TypeScript, targeted ESLint, and the production build passed. A browser session with an authenticated workspace member was not available for visual end-to-end verification.
