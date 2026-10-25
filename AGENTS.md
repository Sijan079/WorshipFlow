<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Worship Flow OS Agent Guide

Worship Flow OS is growing from a worship service preparation platform into a
church management workspace. Worship production remains a distinct, critical
workflow; Events is the first broader church module.

## Project Goal

Help church teams coordinate events while preserving fast, accurate preparation
for one real worship service at a time.

Every feature should directly support at least one of these:

- Create and manage a worship service
- Build and preserve the intended service flow
- Assign people, songs, and production details to that service
- Produce the outputs and handoff steps needed to run that service well
- Coordinate church events, announcements, optional external registration, and attendance

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
- Calendar-first church events with workspace-scoped records

## Out of Scope

Do not introduce product scope or abstractions for:

- Chat or messaging
- Notifications
- General-purpose scheduling platforms beyond church events
- Hosted public event pages or registration forms
- Finance, pastoral care, and general member records until separately designed
- Generic role frameworks or heavy authentication systems
- Social features or engagement mechanics
- Generic admin frameworks unrelated to worship service preparation

## Domain Rules

- The core domain object is `WorshipService`.
- `ChurchEvent` is separate from `WorshipService` and represents a church activity
  such as a fellowship, prayer meeting, or baptism.
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
- Event scheduling may warn about date conflicts but must not silently block an
  organizer's decision to proceed.

## Architecture Rules

Current direction:

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS
- Client state and server cache: TanStack Query
- Forms: React Hook Form with Zod validation
- Backend: REST route handlers in `src/app/api/**/route.ts`
- Persistence: Prisma ORM with PostgreSQL
- Future desktop target: Tauri + Rust
- SaaS identity: Supabase Auth with Prisma-owned workspace membership and invitation records

Implementation rules:

- Treat `src/app` as the main routing surface.
- Read local Next 16 docs before changing routing, data loading, caching, or
  route handlers.
- Keep validation in shared Zod modules such as `src/lib/validation.ts` or
  feature-level validation files.
- Prisma is the source of truth for persistence contracts.
- Workspace APIs must verify active membership and role inside route handlers; Proxy only refreshes sessions and redirects.
- Keep Owner/Admin/Member workspace roles for account compatibility. For implemented church modules, Member access resolves personal allow/block settings before workspace Member defaults; enforce each action in its route handler.
- Event action grants are per person, module, and action; only Owner/Admin may
  administer grants, and handlers must enforce them for member actions.
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
- Keep service UI focused on service-order clarity and production status; keep
  event UI focused on calendar visibility and low-friction coordination.
- Redesigns must not look like generic AI-generated product UI. Start from the
  real worship-production task and existing information architecture; avoid
  ornamental gradients, glow, filler metrics, badge spam, repeated eyebrow
  labels, and equal card grids that do not express a real hierarchy.
- The current login is a temporary workspace access gate. Do not present mock
  user, church, or organization identities before a proper account model is
  explicitly designed.
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
- Keep new church-management schema tied to approved modules and avoid
  speculative generic administration models.

## Working Rules

- Start code navigation at `docs/codebase-map/INDEX.md`, then read only the
  relevant module map. Use `docs/map.md` for product documentation and
  `docs/current-state.md` for the dated project snapshot.
- Treat codebase-map entries as navigation hints, not authoritative code.
  Verify the linked source before changes. Use `npm run codemap -- find <name>`,
  `refs <name>`, or `deps <name-or-path>` for small JSON results; do not load
  the entire `symbols.json` registry into context.
- After code changes, refresh affected entries with `npm run codemap -- update`.
  The indexer reuses unchanged source entries and does not rewrite unchanged
  outputs.
- Keep REST responses and validation type-safe.
- Preserve compatibility with `prisma/` and `src/lib/prisma.ts`.
- Start the development server with `npm run dev` for the configured hosted Supabase development project. Use `npm run dev:docker` when isolated local Supabase data is needed. Do not start Next directly unless the user explicitly asks to bypass the configured startup checks.
- Update `README.md` when setup or workflow instructions materially change.
- If a request conflicts with the worship-service-only scope, call it out
  before implementing it.
- If the repository architecture changes materially, update this guide.

## Planning And Skill Workflow

Before acting, identify every applicable installed skill and read its complete
`SKILL.md`. Use the skill's required gates, ordering, validation, and checklist.
Do not invoke unrelated skills.

Use these skills when their trigger applies:

- `$architecture-designer` for significant architecture, system design,
  foundation decisions, or scalability planning.
- `$code-reviewer` for reviewing code, branches, commits, or pull requests.
- `$test-driven-development` before implementing features, bug fixes,
  refactors, or behavior changes.
- `$owasp-security-check` for authentication, authorization, APIs, secrets,
  uploads, private data, or security reviews.
- `$codebase-documenter` for README, architecture, API, or developer
  documentation.
- `$design-system` for design tokens, component contracts, themes, Figma, or
  Storybook alignment.
- `$design-taste-frontend` for marketing pages or expressive visual redesigns.
- `$web-design-guidelines` for UI, UX, or accessibility reviews.
- `$vercel:react-best-practices` after editing multiple React/TSX components.
- Repo-local skills under `.agents/skills/` whenever their scope applies:
  `worship-flow-scope-guard`, `worship-flow-service-order`,
  `worship-flow-design-system`, `worship-flow-next16-safe`, and
  `worship-flow-ui-ux-audit`.

### Architecture planning

For a significant architecture or foundation decision:

1. Understand functional requirements, non-functional requirements, and
   constraints before choosing a design.
2. Inspect the existing routes, features, Prisma schema, APIs, and docs; reuse
   established patterns before adding abstractions.
3. Identify the smallest fitting architecture and record alternatives,
   trade-offs, operational cost, failure modes, and security boundaries.
4. Produce a high-level Mermaid diagram when component or data flow is not
   obvious.
5. Record each significant decision in an ADR or the existing architecture
   decision document before implementation.
6. Review the proposal against worship-service-only scope, local-first/Tauri
   constraints, data ownership, and the current design system. Revise when
   review finds a gap.

### Iterative change workflow

Work in a loop until the requested change satisfies its spec. Do not treat a
failed check as the end of the task.

1. **Plan:** Read the relevant source files and existing docs, define the
   requested behavior and acceptance criteria, state the scope and applicable
   skills, and identify the smallest useful check or test.
2. **Develop:** Write the smallest useful failing check or test first when
   implementing a feature, bug fix, refactor, or behavior change. Then make
   the minimum code and documentation changes needed to satisfy the plan.
3. **Verify:** Run the narrowest relevant checks, then the project checks
   required by the affected area. Compare the result directly against the
   acceptance criteria and the applicable product, domain, architecture, and
   design rules.
4. **Decide:** If verification passes, report the completed work and evidence.
   If verification finds a failure, regression, or unmet criterion, update the
   plan as needed and return to **Develop**. Repeat **Develop → Verify** until
   the spec passes or a genuine external blocker requires user input.
5. **Document:** Update the matching README, architecture, route, data, or
   design document when the change alters that contract. Report changed files,
   checks completed, skipped work, remaining risks, and any blocker with its
   reason.
