<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# WorshipFlow Agent Guide

WorshipFlow is a multi-church church management system (CMS) with a public
church website per church. Worship production (services, songs, media tools,
captions) is one module inside it.

## Source of truth

Read these before planning product, data, or access changes. They are the
baseline; do not work from older memory of the product.

- `docs/core/Product.md`: identity, modules, behaviors, what is deferred
- `docs/core/Architecture.md`: stack, tenancy, routing, storage, hosting plans
- `docs/core/Data-Model.md`: models and migration order
- `docs/core/Access-and-Privacy.md`: roles, grants, public-site rules, privacy
- `docs/core/Roadmap.md`: build order, per-step checks, open questions
- `DESIGN.md`: the visual contract for new screens

When a decision changes a core doc, record it in `docs/changes/YYYYMMDD.md`
with the from and to text, then update the core doc only once the change is
accepted as permanent. If the code and a doc disagree, say so instead of
silently picking one. The code is authoritative for what exists today; the docs
are authoritative for where the product is going.

## Scope guard

In scope: People, Ministries, Events, Announcements, the public Site (page
builder and posts), Worship (Services, Songs, Media Tools, Captions), Dashboard
summary cards, Settings.

Deferred (see `Product.md`): giving/finance, pastoral care, small groups,
congregant logins and profiles, event RSVP, auto-publishing to social media,
custom domains, a free-form or custom-code page builder (the block editor is in scope), self-serve church signup and billing,
AI background generation, monthly event repeat, the Tauri/desktop app.

Out of scope: chat or messaging, notifications, social features, generic role
frameworks. If a request falls outside the in-scope list, say so before
implementing it.

## Domain rules

- `WorshipService` is one real worship service. New services copy all active
  template blocks in order; UI renders each service's stored block order and
  never a global hard-coded sequence.
- `ChurchEvent` is separate from `WorshipService`. Do not stretch either to cover
  the other.
- `Person` is scoped to one workspace. Birthdate, baptism, and membership data
  are sensitive. Archive instead of delete; hard delete is Owner/Admin only.
- The public site is opt-in per item. No public route may read People, Ministry,
  attendance, or service-assignment data, and public pages are structured blocks,
  never raw HTML.
- Event scheduling may warn about conflicts but never blocks the organizer.
- Generated outputs and automation jobs are persisted records.

## Architecture rules

- Next.js App Router, React, TypeScript, Tailwind, TanStack Query, React Hook
  Form with Zod, REST route handlers, Prisma with PostgreSQL, Supabase Auth and
  Storage. Read `node_modules/next/dist/docs/` before changing routing, data
  loading, caching, or route handlers.
- App pages live only in `src/app/w/[workspaceSlug]/[[...path]]/page.tsx`. The
  public site lives at `/c/{workspaceSlug}`.
- Every workspace route handler verifies active membership, role, and the
  per-action grant itself. Proxy only refreshes sessions and redirects. Hiding a
  URL is never access control.
- Keep Owner/Admin/Member roles. Members resolve personal allow/block settings
  before workspace Member defaults.
- Shared validation lives in Zod modules. Prisma is the source of truth for
  persistence. Prefer feature folders (`src/features/<module>/`) and small
  files; split existing large components only when a change touches them.
- No Tauri or local-SQLite abstractions. Do not couple to cloud-only
  assumptions without need, but do not build for a desktop target either.

## Design rules

`DESIGN.md` is the visual contract; read its experience principles first (the Song Formatter is the reference for feel, Services for structure). Service UI stays focused on service
order and production status; event and People UI stay focused on clarity and
low-friction coordination. Avoid ornamental gradients, glow, filler metrics,
badge spam, repeated eyebrow labels, and equal card grids with no real
hierarchy. Many users are elderly: favor plain wording, large targets, and few
steps. Keep `DESIGN.md` and `tokens.css` aligned.

Changing `DESIGN.md` goes through a grilling session with the owner first (use the `grilling`
skill): bring the proposed change as numbered questions with a recommended answer each, wait for
the owner's answers, then write it, tag each rule Built or Target, and record the from and to text
in `docs/changes/YYYYMMDD.md`. Do not edit `DESIGN.md` as a side effect of other work. A typo or a
Target that has become Built still gets a one-line check with the owner.

## Working rules

- Start the development server with `npm run dev` for the configured hosted Supabase development project. Use `npm run dev:docker` when isolated local Supabase data is needed. Do not start Next directly unless the user explicitly asks to bypass the configured startup checks.
- The `docs/codebase-map/` index and `npm run codemap` no longer exist; use
  search tools on `src/` and `prisma/schema.prisma`.
- Keep REST responses and validation type-safe. Preserve `prisma/` and
  `src/lib/prisma.ts` compatibility.
- `npm test` includes design-rule checks (no text under 12px, no raw hex colors
  in `.tsx`). Existing violations are baselined; new ones fail. See `DESIGN.md`.
- Never commit secrets: provider keys, OAuth client secrets, database dumps.
- Update `README.md` when setup or workflow instructions change. If the
  architecture changes materially, update `docs/core/` through
  `docs/changes/`.

## Change workflow

1. **Plan:** read the relevant source and core docs, state acceptance criteria,
   and name the smallest useful check.
2. **Develop:** write the failing check first for features, fixes, and
   refactors, then the minimum change that passes it.
3. **Verify:** run the narrowest relevant checks, then the project checks for
   the affected area (`npm test`, `npm run lint`, type check). Compare against
   the acceptance criteria and the core docs.
4. **Decide:** if verification fails, return to Develop. Stop only for a real
   external blocker.
5. **Document:** update the matching doc when a contract changes. Report changed
   files, checks run, skipped work, and remaining risks.

Use installed skills when their trigger applies (TDD before behavior changes,
security review for auth, APIs, uploads and private data, code review for
reviews, documentation skills for docs). Read the skill's full `SKILL.md`
before applying it.
