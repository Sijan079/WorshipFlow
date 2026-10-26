# Architecture

Baseline: 2026-10-26, revised same day (see `docs/changes/20261026.md`).
Later changes are recorded in `docs/changes/YYYYMMDD.md`.
Read `node_modules/next/dist/docs/` before changing routing, data loading,
caching, or route handlers; this Next.js version (16) differs from older ones.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, TanStack Query,
React Hook Form with Zod, REST route handlers in `src/app/api/**/route.ts`,
Prisma with PostgreSQL, Supabase Auth, Supabase Storage.

## Dropped assumptions

- No Tauri/desktop target and no local SQLite sync path. Do not add adapters or
  abstractions for them.
- The local-filesystem fallback in `src/lib/private-output-storage.ts` stays
  until it blocks something; remove code only when it does.

## Tenancy

- A church is a `Workspace`. Everything church-owned carries `workspaceId`.
- API: `/api/workspaces/{slug}/...`. `src/proxy.ts` rewrites it and sets
  `x-worship-workspace-slug`; the proxy only refreshes the session and redirects.
  Every route handler must itself verify active membership, role, and the
  per-action grant. Never rely on the proxy for authorization.
- Workspaces are provisioned by hand (`npm run provision:workspace`).
- A `Person` belongs to exactly one workspace. There is no cross-church identity.

## Surfaces and routing

- App: `src/app/w/[workspaceSlug]/[[...path]]/page.tsx`, a `switch` on the path.
  Do not add folder-per-route pages for the app elsewhere.
- Public site: `/c/{workspaceSlug}`, no login. Added with the Site module. It
  has its own simple layout, separate from the app shell.
- Legacy bare paths (`/dashboard`, `/services`, ...) are redirected to
  `/workspaces` by `src/proxy.ts` (`LEGACY_WORKSPACE_PATHS`).
- Public routes: login, auth callback, `/captions/live/{id}`, and `/c/{slug}`.

## Public site rendering

- Pages are cached and pre-rendered; public endpoints are rate limited.
  Read this Next.js version's caching docs before building.
- Public routes read through a narrow data layer that returns only public-safe
  fields. They must not import the People, Ministry, or attendance data access.
- Search visibility: per-church `indexable` switch. Default off, which sends
  `noindex` and omits the church from any sitemap.

## Code layout

- New work goes in small files under `src/features/<module>/`.
- Existing 1,500-2,200 line components (`service-builder-client.tsx`,
  `services-page-client.tsx`, `settings-page-client.tsx`) are split only when a
  change touches them. No dedicated refactor project.
- Shared validation lives in Zod modules (`src/lib/validation.ts` or
  feature-level validation files). Prisma is the source of truth for persistence.

## Storage

Supabase Storage private bucket via `src/lib/private-output-storage.ts`.
Verified against Supabase docs on 2026-10-26 (Free plan):

- 500 MB database, 1 GB file storage, 5 GB egress, two free projects.
- 50 MB per-file cap that Free projects cannot raise.
- A project is paused after low activity over 7 days; it can be restored within
  1 year. A few database requests a day keep it active; reads versus writes is
  not stated in the docs.
- Backup behavior on Free is not confirmed. Check the dashboard.

Limits are shared by every church in one project, so the background library
needs a visible per-workspace storage meter. Google Drive is not integrated; at
most it is a pasted link.

## Hosting plans and keep-alive

- Vercel Hobby cron: up to 100 jobs per project, each at most once per day,
  with timing precision of +/- 59 minutes.
- **Keep-alive** (built, step 4): `vercel.json` schedules `GET /api/internal/keep-alive` daily at
  `0 3 * * *` (03:00 to 03:59 UTC on Hobby). Vercel sends the project's `CRON_SECRET` as a bearer
  token; the route (`src/lib/cron-auth.ts`) refuses a missing, wrong, or too-short (under 32
  characters) secret and compares in constant time. It stamps one row (`KeepAlive`, no church
  data) with the current time. A write is used because a bare read may not count as activity. The
  write is idempotent because Vercel never retries a missed run, may deliver a run twice, and does
  not follow redirects, so the route is reachable without login (`proxy-paths.ts`) and guards
  itself. Cron does not run under `next dev`; call the route directly to test it.
- Vercel Hobby is non-commercial personal use only. "Commercial" includes any
  site used for the financial gain of anyone involved in producing it, including
  a paid employee or consultant writing the code, or receiving payment to host
  it. Donations do not count. Hobby is the plan for development and the first
  church. **Trigger to move to a paid plan: when another church asks to be
  incorporated into the system.** Vercel's terms apply independently of this
  trigger, so check them against the real situation if anyone is paid for the
  work.
- The free plans suit development and the first church. A public site that
  anyone may visit should not depend on a database that can pause; treat the
  paid Supabase plan as a requirement before promoting the site.

## External services

OpenAI/Gemini (optional AI, workspace integrations), Deepgram and Azure
Translator (captions). Keys are server-only and never use a `NEXT_PUBLIC_` name.
