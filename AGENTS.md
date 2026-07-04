<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation
notices.
<!-- END:nextjs-agent-rules -->

# Worship Flow OS Agent Guide

This repository is for **Worship Flow OS**, a church worship service preparation
platform for tech teams.

The system is focused on preparing **worship services only**. It is not a
general church management platform, not a social product, and not an
event-management system.

## Product Scope

Agents working in this repository should prioritize these phase 1 capabilities:

- Worship service CRUD
- Service block rendering in strict order
- Participant assignment
- Song repository management
- Adding songs to worship services
- Temporary media bridge workflows for phone-to-booth handoff
- Automation job persistence
- Generated output persistence

## Out of Scope

Do not introduce features or abstractions for:

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

The core domain object is `WorshipService`.

One `WorshipService` represents one real worship service, such as:

- Sunday Service
- Ladies Ministry Worship Service
- Youth Worship Service

Do not expand the meaning of `WorshipService` to cover unrelated church
activities.

Each church/workspace may define its own worship service templates and program
block order.

Rules that must not change:

- Service templates own the intended block order for newly created services.
- New services should copy all active blocks from their selected template
  immediately, preserving the template order at creation time.
- UI rendering should respect each service's stored block order and never
  reorder blocks from a global hard-coded sequence.
- Built-in block enums may still be used as internal behavior hints, but they
  must not force every church into the same visible lineup.

## Architecture Rules

The current project direction is:

- Web frontend: Next.js App Router with React and TypeScript
- Styling: Tailwind CSS
- Client state and server cache: TanStack Query
- Forms: React Hook Form with Zod validation
- Backend: REST API implemented with Next route handlers
- Persistence: Prisma ORM with PostgreSQL
- Desktop compatibility target: future Tauri + Rust client

Implementation rules for this repository:

- Treat `src/app` as the main application routing surface.
- Keep REST endpoints in `src/app/api/**/route.ts`.
- Use App Router conventions and read local Next 16 docs before changing
  routing, data loading, caching, or route handlers.
- Keep validation centralized in shared Zod modules such as
  `src/lib/validation.ts` or feature-level validation files.
- Prisma is the source of truth for persistence contracts.
- Prefer feature-based organization over generic utility sprawl.
- Favor straightforward modules, explicit data flow, and strong typing over
  clever abstractions.
- Shared logic should be portable so it can later be reused by web and desktop
  clients.

## Tauri / Local-First Constraints

This project should stay compatible with a future local-first desktop
architecture.

When implementing features:

- Avoid browser-only APIs in shared logic.
- Keep file system operations behind abstractions so future Rust/Tauri adapters
  can replace web-only implementations.
- Do not tightly couple core workflows to cloud-only assumptions.
- Design persistence and API contracts so future SQLite sync can coexist with
  PostgreSQL-backed workflows.
- Prefer domain services and adapters that can later support local and remote
  persistence paths without rewriting business rules.

# UI Design Source of Truth

Ignore older local design rules that conflict with the Stitch MCP project named
**Worship Production OS** (`13697574181324164099`). The active design source is
the Stitch design system named **Production Grade Interface**.

When changing UI, follow the Stitch system:

- Modern dark-mode production interface for worship service preparation.
- Persistent 280px left OS rail on desktop; compact workflow navigation on
  tablet/mobile.
- Inter for primary interface text; Geist for labels, metadata, and technical
  readouts.
- Deep slate surfaces, electric purple primary actions, atmospheric blue
  technical indicators, red alert states, and high-contrast cool text.
- 8px default control/card radius, 4px small chips, 12px large containers.
- Tonal layering and subtle outlines for depth; low-opacity purple ambient
  shadow only when elevation needs to read.
- Inputs should appear etched into the surface and use purple focus treatment.
- Service cards may use drag handles and a left active-state stripe.
- Status indicators may use saturated pips for Live, Ready, Idle, and Alert
  states.
- Inspector-style panels may be compact and data-dense.

`DESIGN.md` and `tokens.css` should stay aligned with the Stitch MCP design
system when future UI work changes the visual language.

## Data Contract Notes

When changing data models or API behavior:

- Keep the Prisma schema aligned with the approved Worship Flow OS domain schema
  unless the user explicitly requests a change.
- Preserve the strict enum-driven block model and related domain terminology.
- Seed data should stay centered on the provided Ladies Ministry sample service
  unless the user asks for different fixtures.
- Treat generated outputs and automation jobs as persisted records, not
  transient UI-only state.
- Avoid introducing schema fields that generalize the app away from
  worship-service preparation without an explicit product request.

## Working Rules

When contributing as an agent in this repository:

- Read relevant local Next 16 docs in `node_modules/next/dist/docs/` before
  touching framework-sensitive code.
- Keep REST responses and validation type-safe.
- Prefer simple types, explicit code, and maintainable modules over premature
  abstraction.
- Reuse shared domain constants and enums when enforcing worship block behavior.
- Preserve compatibility with `prisma/` schema management and the Prisma client
  setup in `src/lib/prisma.ts`.
- Do not start the dev server. The user is responsible for starting and
  stopping the dev server when they want to test the app locally.
- Update `README.md` when setup steps, developer workflow, or run instructions
  materially change.
- If a requested change conflicts with the worship-service-only scope, call it
  out clearly before implementing it.

## Current Repo Alignment

These instructions are written to match the current repository state:

- Next.js `16.2.6`
- App Router code under `src/app`
- Route handlers under `src/app/api`
- Prisma schema and seed files under `prisma/`
- Prisma PostgreSQL client setup under `src/lib/prisma.ts`

If the repository architecture changes materially, update this guide to keep it
accurate.
