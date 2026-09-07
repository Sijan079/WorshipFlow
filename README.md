# WorshipFlow

WorshipFlow is a production workspace for preparing one real worship service
at a time. It helps church worship and technical teams preserve the intended
service order, assign people and songs, prepare booth media, and persist the
outputs needed to run the service.

It is not a general church-management, scheduling, messaging, or social
platform.

## Current Workflows

### Worship Services

- Create regular and First Sunday service records from saved templates
- Copy active template blocks into each new service in strict stored order
- Review services in a responsive, open-ledger register
- Edit service details, scripture, Tipan or Pahayag, servants, and hymnals
- Parse participant text into the service composer
- Add songs, people, details, assets, jobs, and generated outputs to a service

### Songs

- Upload or paste lyrics
- Extract and normalize lyrics locally or with optional AI assistance
- Edit verse, chorus, bridge, and repeat blocks
- Maintain a song repository with musical and language metadata

### Production Media

- Transfer phone screenshots to the booth
- Generate QR codes
- Upload or paste images, trim unused borders, and resize them locally for
  phone and tablet screens
- Generate worship backgrounds when an AI provider is configured
- Persist generated files and automation job status

### Workspace Setup

- Review servants in a responsive roster with initials, search, group filters,
  selection, and bulk assignment
- Configure ministries, service templates, song tags, and checklists
- Use the dark, operator-first Production Grade Interface across desktop and
  mobile layouts

## Domain Rules

`WorshipService` is the core domain object. One record represents one real
worship service.

New services copy all active blocks from the selected template. After
creation, the service owns that stored order. UI code must render that order
and must not replace it with a global hard-coded lineup.

See [AGENTS.md](AGENTS.md) for product and architecture guardrails and
[DESIGN.md](DESIGN.md) for the visual system.

## Stack

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS 4 with semantic tokens from `tokens.css`
- Radix UI primitives and shared local UI components
- TanStack Query for client state and server cache
- React Hook Form and Zod validation
- Prisma ORM with PostgreSQL
- Optional OpenAI and Supabase integrations

## Local Setup

Requirements:

- Node.js
- PostgreSQL or Supabase Postgres

Install dependencies:

```powershell
npm install
Copy-Item .env.example .env
```

Set both `DATABASE_URL` and `DIRECT_DATABASE_URL` in `.env`, then prepare the
database:

```powershell
npx prisma migrate deploy
npx prisma db seed
```

Start the local app:

```powershell
npm run dev
```

The default local URL is `http://localhost:3000`.

### Docker Supabase Auth

Use this mode when the app, database, API, and authentication should all run
against the local Docker Supabase stack.

1. Add the Google OAuth credentials to the ignored root `.env` file:

   ```env
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="your-google-client-id"
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET="your-google-client-secret"
   ```

2. In the same Google Cloud web OAuth client, add:

   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `http://127.0.0.1:54321/auth/v1/callback`

   Google returns to Supabase at the second URL. Supabase then returns to the
   app at `http://localhost:3000/auth/callback`; the app callback does not
   belong in Google's redirect URI list.

3. Launch local Supabase and Next.js together:

   ```powershell
   npm run dev
   ```

`npm run dev` starts Docker Desktop automatically on Windows when needed, waits
for its daemon, starts the local Supabase Docker stack, then loads
`.env.local.docker`, and applies the checked-in Prisma migrations before Next.js
starts. On a fresh local database, it safely bootstraps the Prisma baseline before
applying future migrations. Those process variables override hosted values in `.env.local`, keeping the OAuth callback on
`http://localhost:3000/auth/callback`. Use `npm run dev:docker` for the same
Docker-backed startup explicitly.

### Importing a Remote Workspace Locally

To copy only the remote workspaces where a locally signed-in user has active
membership, first create a local Auth account by signing in at
`http://localhost:3000`. Then, after making a local database backup, run:

```powershell
node scripts/import-remote-workspace.mjs --email owner@example.com --apply --reset-local
```

This replaces local app tables only. It preserves local Supabase Auth, maps the
matching app user to the local Auth identity, and skips encrypted integrations
and file-backed records until Storage objects are copied separately.

The deployed app remains separate: Vercel must use the hosted Supabase URL,
the hosted Supabase Site URL stays `https://sndev-worship-flow.vercel.app`, and
its redirect allowlist includes
`https://sndev-worship-flow.vercel.app/auth/callback`.

## Environment

Required:

- `DATABASE_URL`: pooled application connection
- `DIRECT_DATABASE_URL`: direct connection for Prisma migrations

Optional:

- `APP_URL`: public application URL used for invitation callbacks
- `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase Auth SSR configuration
- `SUPABASE_SECRET_KEY`: server-only Supabase admin key for invitations
- `OPENAI_API_KEY`: AI-assisted lyric cleanup and image generation
- `GITHUB_TOKEN`: server-only token with Issues write access for sending user
  reports to `Sijan079/WorshipFlow`; create the `issue` and `feedback` labels
  in that repository before enabling submissions
- `WORKSPACE_INTEGRATION_ENCRYPTION_KEY`: server-only key used to encrypt workspace AI integration overrides
- `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: realtime features
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and
  `SUPABASE_PRIVATE_BUCKET`: private generated-output storage
- `WORSHIP_WORKSPACE_SLUG`: fallback workspace slug for local jobs; normally
  leave this as `default`
- `GEMINI_API_KEY` and `GEMINI_BACKGROUND_VIDEO_MODEL`: optional video
  generation configuration
- `MEDIA_GENERATION_VIDEO_HOURLY_LIMIT` and
  `MEDIA_GENERATION_VIDEO_DAILY_LIMIT`: optional video generation limits

Removed authentication settings:

- `APP_ACCESS_USER`
- `APP_ACCESS_PASSWORD`
- `APP_ACCESS_SESSION_SECRET`

These belonged to the retired shared-password gate and should be removed from
local and deployment environments. Supabase Auth is now the only supported
application authentication mechanism.

See `.env.example` for the complete list.

### Google OAuth setup

Google sign-in is handled by Supabase Auth. The downloaded Google OAuth client
JSON (for example, `client_secret*.json`) is local setup material only; the app
does not read it. The repository ignores those files. Never copy the client
secret into source code, a `NEXT_PUBLIC_*` variable, or this repository.

1. In Google Cloud Console, create or select a Web OAuth client.
2. Add Supabase's callback URL as an authorized redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard → Authentication → Providers → Google, enable Google
   and enter the client ID and client secret from the local JSON file.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the local `.env` and deployment
   environment. Set `APP_URL` to the app's public URL for callback redirects.

The Google client secret belongs in Supabase's server-side provider settings,
not in the app's environment variables. The app only receives Supabase's
public URL and publishable key in the browser. If the secret has been exposed,
rotate it in Google Cloud Console before continuing.

## Authentication and Workspaces

Supabase Auth provides user sessions and email invitations. Each church is a
workspace addressed at `/w/{workspaceSlug}`. Access requires an active
workspace membership. Owners and Admins can manage invitations; Members have
read-only access.

Provision a workspace with:

```powershell
npm run provision:workspace -- --name "Example Church" --slug example --owner-email owner@example.com
```

See [docs/architecture.md](docs/architecture.md) for the tenancy boundary and
invitation flow.

## Commands

```powershell
npm run dev       # Local development
npm run dev:docker # Local development with Docker Supabase
npm run build     # Prisma generation and production build
npm run lint      # ESLint
npm test          # Security and domain checks
```

## Design Rules

The interface is a dark worship-production workspace, not a generic SaaS
dashboard. Use semantic tokens, real domain data, restrained motion, visible
focus states, and purposeful containment.

Avoid ornamental gradients, glow, fake metrics, badge spam, repeated eyebrow
copy, unnecessary card grids, and nested modal surfaces. Prefer typography,
spacing, alignment, and dividers before adding another container.

## Near-Term Direction

- Continue the page-by-page UI and accessibility overhaul
- Connect configured checklists to service preparation without making the
  dashboard an alternate editing surface
- Finish service-order, song, media-handoff, automation, and generated-output
  workflows
- Design proper accounts separately before introducing organization or access
  management UI
