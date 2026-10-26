# WorshipFlow

WorshipFlow is becoming a multi-church church management system with a public
church website for each church. Each church is a workspace. It began as a
worship-service preparation tool; that work is now the Worship module.

**Where the product is going** is recorded in [`docs/core/`](docs/core/):
[Product](docs/core/Product.md), [Architecture](docs/core/Architecture.md),
[Data model](docs/core/Data-Model.md),
[Access and privacy](docs/core/Access-and-Privacy.md), and
[Roadmap](docs/core/Roadmap.md). Later changes to those decisions are logged in
`docs/changes/YYYYMMDD.md`. Agent and contributor rules are in
[AGENTS.md](AGENTS.md); the visual contract is [DESIGN.md](DESIGN.md).

**What exists today** is described under Current Workflows below: Worship
(services, songs, media tools, sermon captions), a calendar-first Events
foundation, People and Ministries (the roster, with a PEOPLE permission), and
workspace settings and access. **Planned, not built yet:** Announcements, the
public Page Builder site, and a summary Dashboard.

Server failures use structured logs and OpenTelemetry trace annotations. Run
`npm run test:observability` to verify failure metrics and trace correlation.

## Current Workflows

### Events

- Open the month calendar at `/w/{workspaceSlug}/events`, with a secondary list view
- Create a one-time event with a date, time, venue, details, and optional external form link
- See overlapping events as warnings; conflicts do not prevent creation
- Store event, occurrence, announcement, visitor, and action-grant foundations in Prisma
- Keep event records separate from worship services and their stored block order
- In Settings → Membership, Admins can set Member defaults for Events View and Create, then allow or block those actions for an individual Member

### Sermon Captions

Open `/w/{workspaceSlug}/captions` on the booth PC. In **Audio setup**, select and test the PC input fed by the Ui24R speech AUX. Switch to **Live captions**, start the session, and share its text-only viewer link. Keep the booth Captions page open in its own tab or window during the broadcast; navigating that same tab to another page ends the booth stream. The link stays the same through temporary booth connection drops; the viewer distinguishes starting, live, interruption, and terminal errors. It shows the newest ten translated lines first. Stop the session when the service ends; its final ten lines remain available on the viewer for one hour, then expire. One session can run per workspace and expires after three hours. For the initial one-member pilot, share the session link directly with that member; anyone who receives the link can read it. Each later service gets a new link. Admins can set Member defaults and individual grants for **View captions** and **Start and stop captions** in Settings → Membership; a Member needs both actions to operate the booth feed.

Set `DEEPGRAM_API_KEY`, `AZURE_TRANSLATOR_KEY`, and `AZURE_TRANSLATOR_REGION` in the server environment. The Deepgram key needs **Member** permission to issue temporary browser tokens. The Azure Translator key and Deepgram API key must never use a `NEXT_PUBLIC_` name. Apply the `20261025000000_sermon_captions_live`, `20261025010000_caption_module_permissions`, `20261025020000_caption_connection_state`, `20261025030000_caption_usage_day`, and `20261025040000_caption_usage_baseline` Prisma migrations in each environment. Audio goes from the booth browser to Deepgram; recognized text goes through WorshipFlow to Azure. Viewers receive only English text from the temporary link.

Owner/Admin can open `/w/{workspaceSlug}/settings?tab=usage` to see the current UTC month's Azure characters. If a dated Azure Monitor baseline exists, the page shows the baseline plus later characters metered through this workspace as an estimate; use outside WorshipFlow after the export is excluded. The Angeles City Bible Church hosted development workspace has an October 2026 baseline of 8,538 characters from an Azure Monitor export ending October 25 at 19:54:44 Asia/Manila. For Deepgram project balances, also set server-only `DEEPGRAM_PROJECT_ID` and a separate `DEEPGRAM_BILLING_API_KEY` with billing access; without them, the page points to the Deepgram Console. The balance response does not identify free versus paid credits. The page does not stop broadcasts at a threshold.

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
- Edit lyrics directly on Word-style pages with section tagging, grouping,
  an optional outline, and undo/redo
- Export FreeShow-compatible DOCX and resume the latest temporary draft across
  your devices; phones use continuous editing with a separate page preview
- Maintain a song repository with musical and language metadata

### Production Media

- Transfer phone screenshots to the booth
- Generate QR codes
- Upload or paste images, trim unused borders, and resize them locally for
  phone and tablet screens
- Generate worship backgrounds when an AI provider is configured
- Persist generated files and automation job status

### Local Media Worker Spike

To try the proposed `yt-dlp` worker flow without changing the app, install
`yt-dlp` and FFmpeg on your PATH, then run:

```powershell
npm run try:media-worker
npm run try:media-worker -- --format mp4
```

The command creates a two-second local fixture, serves it on localhost, runs
`yt-dlp` and FFmpeg, and writes an MP3 or MP4 plus `job.json` under ignored
`.tmp/media-worker-spike/<job-id>/`. JSON status lines show `queued`,
`processing`, and `done` or `failed`. This verifies the local processing path;
it does not verify YouTube availability or permission to download a video.

For a YouTube video you have permission to download and convert, use the
explicit opt-in:

```powershell
npm run try:media-worker -- --url "https://www.youtube.com/watch?v=VIDEO_ID" --format mp3 --execute --rights-confirmed
```

The real URL mode accepts HTTPS YouTube URLs only, downloads one video, and
limits the file to 100 MB. Keep this local experiment separate from the
deployed app; the media converter remains disabled for web deployment.

### Workspace Setup

- Keep the church roster on the People page (search, status and ministry filters,
  archive and restore, bulk add to a ministry) and manage ministries on the
  Ministries page
- Configure service templates, song tags, and checklists
- Use the Production Grade Interface across desktop and mobile layouts

## Domain Rules

`WorshipService` is the core domain object. One record represents one real
worship service.

New services copy all active blocks from the selected template. After
creation, the service owns that stored order. UI code must render that order
and must not replace it with a global hard-coded lineup.

See [AGENTS.md](AGENTS.md) for guardrails, [docs/core/](docs/core/) for the
product baseline, and [DESIGN.md](DESIGN.md) for the visual system.

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

Put the hosted Supabase URL, publishable key, secret key, matching pooled
`DATABASE_URL`, and migration-safe `DIRECT_DATABASE_URL` in ignored `.env.local`.
Use `.env` for optional local settings. Start the local app against the hosted
project:

```powershell
npm run dev
```

The default local URL is `http://localhost:3000`. Changes made through the app
appear in the hosted Supabase project selected by `.env.local`. `npm run dev`
checks that Auth, Storage, and Postgres target the same project before starting.
It does not apply schema migrations automatically; run and review migrations
separately before using new database fields. Do not run the seed script against
an existing hosted project unless you intend to add its sample records. This is
a live project connection,
so use a dedicated development project if you need isolated test data.

In **Settings → Templates → Comment Card Name Template**, administrators can
save several default filenames and choose one active name. Comment Card loads
the active name each time the module opens while keeping saved comment content
and layout settings.
Apply the checked-in Prisma migration before using this setting on a database.

For local sign-in with hosted Supabase, open that project's **Authentication →
URL Configuration** in the Supabase Dashboard. Keep the deployed app as the
Site URL and add `http://localhost:3000/**` to **Redirect URLs**. The app sends
`http://localhost:3000/auth/callback` with a `next` query parameter for Google
and email sign-in. Without the localhost allowlist entry, Supabase can return
to the deployed Site URL instead. `supabase/config.toml` only configures the
local Docker stack; it does not update hosted Auth settings.

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
   npm run dev:docker
   ```

`npm run dev:docker` starts Docker Desktop automatically on Windows when needed, waits
for its daemon, starts the local Supabase Docker stack (excluding the optional
Vector log collector), then loads
`.env.local.docker`, and applies the checked-in Prisma migrations before Next.js
starts. On a fresh local database, it safely bootstraps the Prisma baseline before
applying future migrations. Those process variables override hosted values in `.env.local`, keeping the OAuth callback on
`http://localhost:3000/auth/callback`.

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
workspace membership. Owners and Admins can manage invitations. Members see only
what their per-module, per-action grants allow; the Member default for new
modules is no access. Accounts are for the church's tech team; congregants do
not log in and will see only the public site.

Provision a workspace with:

```powershell
npm run provision:workspace -- --name "Example Church" --slug example --owner-email owner@example.com
```

See [Architecture](docs/core/Architecture.md) for the tenancy boundary and
[Access and privacy](docs/core/Access-and-Privacy.md) for roles and grants.

## Commands

```powershell
npm run dev       # Local Next.js with hosted Supabase
npm run dev:docker # Local development with Docker Supabase
npm run build     # Prisma generation and production build
npm run lint      # ESLint
npm test          # Security and domain checks
npm run test:formatter-file -- "C:\\path\\song.docx" # Print formatter output for a DOCX or PDF
npm run test:resize-image -- "C:\\path\\screenshot.png" --width 1920 --height 1080 # Render standard and text-clarity comparison PNGs without starting the app
npm run test:resize-image -- "C:\\path\\screenshot.png" --width 1080 --height 2400 --crop 40,120,900,600 # Resize first, then crop in target pixels; use --trim for automatic post-resize border removal
npm run test:resize-image -- "C:\\path\\screenshot.png" --width 2400 --height 2400 --fit fill # Fill the complete target without distortion by center-cropping overflow
npm run test:resize-image -- "C:\\path\\screenshot.png" --width 2400 --height 2400 --fit fill --sharpness 0.9 # Compare edge-aware text sharpening; accepted range is 0 to 2
npm run test:resize-image -- "C:\\path\\screenshot.png" --width 2400 --height 2400 --fit contain --ai # Add a local Real-ESRGAN comparison; the official portable model downloads once into .tmp/tools
npm run test:resize-image -- "C:\\path\\screenshot.png" --width 2400 --height 2400 --fit contain --ai --ai-provider openai --ai-region 300,200,1900,1400 # Retain the experimental OpenAI region-edit comparison
npm run test:song-editor # Document editing, pagination, and draft recovery tests
npm run test:formatter-drafts # Local PostgreSQL lifecycle/concurrency tests
npm run cleanup:formatter # Delete expired formatter payloads once; -- --watch repeats every five minutes
npm run verify:song-editor # Isolated browser fixture at http://127.0.0.1:4318
```

The song editor fixture uses test identity responses and the real editor/DOCX
code. It does not access workspace data. For the full authenticated workflow,
use `npm run dev`. The formatter supports editing and temporary cross-device
draft recovery. The normal development
command starts the five-minute draft cleanup runner. Production requires an authenticated cleanup schedule
(a secret-protected call to `/api/internal/formatter-cleanup`) before enabling
this workflow; no cloud scheduler is provisioned by local development.

For the real server-backed recovery hook in disposable local database fixtures:
`node --env-file=.env.local.docker --experimental-strip-types scripts/verify-formatter-drafts.mjs`.
This serves port 4319, creates isolated test identities, and removes them on
Ctrl+C. It never bypasses application authentication. Browser assertions live in
`scripts/fixtures/assert-server-draft.js` and `assert-song-actions.js`.

The formatter keeps zoom and save status in its separate top controls card.
At 50% or 75%, the editable viewer shows two pages when both fit; narrow
windows and phones remain single-column. DOCX downloads preserve the editor
filename and spaces (for example, `Way Maker.docx`) without adding `-lyrics`.
The browser regression scripts include `scripts/fixtures/assert-song-two-pages.js`
for desktop layout, selection, editing, undo and responsive fallback checks.
`scripts/fixtures/assert-song-editor-focus.js` covers later-page Enter/caret
scrolling, available-height layout, section highlighting and pinned outline
move controls.
`scripts/fixtures/assert-song-ribbon.js` verifies inline title editing, save
indicators, direct section actions, menu highlights and clear confirmation.

## Design Rules

See [DESIGN.md](DESIGN.md) for the visual contract.
Use semantic tokens, real domain data, restrained motion, visible focus states,
and purposeful containment. Avoid ornamental gradients, glow, fake metrics,
badge spam, repeated eyebrow copy, unnecessary card grids, and nested modal
surfaces. Many users are elderly: favor plain wording and large targets.

## Near-Term Direction

Follow [docs/core/Roadmap.md](docs/core/Roadmap.md): finish deploying People and
Ministries (applying the queued Servant drop), then a daily database keep-alive,
Events repeat and headcounts, Announcements, and the public Page Builder site.
