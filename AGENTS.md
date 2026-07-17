<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in
`node_modules/next/dist/docs/` before changing framework-sensitive code.
Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Worship Flow OS Agent Guide

Worship Flow OS is a worship service preparation platform for church tech and
production teams. It is for preparing **worship services only**.

## Project Goal

Help a team prepare one real worship service at a time with speed, clarity, and
strict service-order accuracy.

Every feature should directly support at least one of these:

- Create and manage a worship service
- Build and preserve the intended service flow
- Assign people, songs, and production details to that service
- Produce the outputs and handoff steps needed to run that service well

## In Scope

Phase 1 work should prioritize:

- Worship service CRUD
- Service block rendering in strict stored order
- Participant assignment
- Song repository management
- Adding songs to worship services
- Temporary media bridge workflows for phone-to-booth handoff
- Automation job persistence
- Generated output persistence

## Out of Scope

Do not introduce product scope or abstractions for:

- Chat or messaging
- Notifications
- Recurring events
- General event management
- Fellowships or prayer meetings
- Scheduling platforms
- Complex RBAC or heavy authentication systems
- Social features or engagement mechanics
- Generic admin frameworks unrelated to worship service preparation

## Domain Rules

- The core domain object is `WorshipService`.
- One `WorshipService` represents one real worship service such as Sunday,
  Ladies Ministry, or Youth Worship Service.
- Do not expand `WorshipService` to cover unrelated church activities.
- Each church or workspace may define its own worship service templates and
  block order.
- New services must copy all active blocks from the selected template at
  creation time and preserve that order.
- UI rendering must respect each service's stored block order and never replace
  it with a global hard-coded sequence.
- Built-in block enums may guide behavior, but must not force every church into
  the same visible lineup.

## Architecture Rules

Current direction:

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS
- Client state and server cache: TanStack Query
- Forms: React Hook Form with Zod validation
- Backend: REST route handlers in `src/app/api/**/route.ts`
- Persistence: Prisma ORM with PostgreSQL
- Future desktop target: Tauri + Rust

Implementation rules:

- Treat `src/app` as the main routing surface.
- Read local Next 16 docs before changing routing, data loading, caching, or
  route handlers.
- Keep validation in shared Zod modules such as `src/lib/validation.ts` or
  feature-level validation files.
- Prisma is the source of truth for persistence contracts.
- Prefer feature-based organization over generic utility sprawl.
- Favor straightforward modules and explicit data flow over clever abstraction.
- Reuse shared domain constants and enums for worship block behavior.

## Local-First Constraints

- Avoid browser-only APIs in shared logic.
- Keep file system operations behind abstractions for future Tauri adapters.
- Do not tightly couple core workflows to cloud-only assumptions.
- Keep persistence and API contracts compatible with a future local SQLite sync
  path alongside PostgreSQL-backed workflows.

## UI Rules

- The active UI source of truth is the Stitch system **Production Grade
  Interface** from the **Worship Production OS** project
  (`13697574181324164099`).
- Treat `DESIGN.md` as the detailed source of truth for visual, token, layout,
  component, and motion decisions.
- Keep UI work focused on service-order clarity, production status visibility,
  and low-friction task completion under pressure.
- Redesigns must not look like generic AI-generated product UI. Start from the
  real worship-production task and existing information architecture; avoid
  ornamental gradients, glow, filler metrics, badge spam, repeated eyebrow
  labels, and equal card grids that do not express a real hierarchy.
- Prefer CSS and Tailwind transitions first, use Motion only when state or
  layout changes need help staying understandable, and consider native browser
  or Next.js View Transitions only later for major page navigation.
- Keep `DESIGN.md` and `tokens.css` aligned when the design language changes.

## Data Rules

- Keep the Prisma schema aligned with the approved Worship Flow OS domain
  schema unless the user explicitly requests otherwise.
- Preserve the strict enum-driven block model and domain terminology.
- Keep seed data centered on the Ladies Ministry sample service unless asked
  otherwise.
- Treat generated outputs and automation jobs as persisted records, not
  transient UI-only state.
- Avoid schema fields that generalize the app away from worship-service
  preparation without an explicit product request.

## Working Rules

- Keep REST responses and validation type-safe.
- Preserve compatibility with `prisma/` and `src/lib/prisma.ts`.
- Do not start the dev server.
- Update `README.md` when setup or workflow instructions materially change.
- If a request conflicts with the worship-service-only scope, call it out
  before implementing it.
- If the repository architecture changes materially, update this guide.
