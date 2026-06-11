# Vercel Deployment

## Deployment Checklist

- Create a production PostgreSQL database.
- Configure all required Vercel environment variables.
- Set `APP_ACCESS_PASSWORD` for both Preview and Production.
- Confirm `npm run build` passes locally.
- Confirm production migrations are ready with `prisma migrate deploy` before
  promoting a database-backed deploy. Vercel runs migrations only when
  `DIRECT_DATABASE_URL` is configured.
- Deploy from the repository root with the Next.js preset.
- Visit `/api/health` after deploy and confirm `ok: true`.
- Test service creation, Song Formatter, and Media Tools.
- Test PAP phone transfer by uploading from phone, viewing from desktop, and
  downloading or deleting from the shared inbox.

## Web App

The Next.js app can be deployed to Vercel from the repository root.

Required project settings:

- Framework preset: Next.js
- Install command: `npm install`
- Build command: `npm run vercel-build`
- Output directory: Next.js default

## Environment Variables

For local development, `.env` is ignored. For deployment, configure variables in
the Vercel project dashboard.

Required variables:

- `DATABASE_URL`

`DATABASE_URL` must be a PostgreSQL connection string reachable from Vercel.
Supabase is supported, but it is not required; any managed Postgres provider is
acceptable as long as the URL, credentials, SSL settings, and network access are
valid for Vercel serverless functions.

Optional database variables:

- `DIRECT_DATABASE_URL`

Use `DIRECT_DATABASE_URL` for Prisma migrations when a direct or migration-safe
connection is reachable from the build environment. If `DIRECT_DATABASE_URL` is
not set, `scripts/vercel-build.mjs` skips `prisma migrate deploy` and continues
with client generation plus the Next.js build.

The project currently pins `prisma`, `@prisma/client`, and
`@prisma/adapter-pg` to `6.19.0`. Prisma 7 CLI builds were blocked by Windows
Security as `Trojan:JS/ShaiWorm.DBA!MTB` on the local Windows development
machine even after a security definitions update. Prisma 6.19.0 generated
successfully, passed local build verification, and keeps the classic
`url = env("DATABASE_URL")` datasource contract in `prisma/schema.prisma`.

Supabase setup:

- Create a Supabase project.
- Copy the pooled Postgres connection string into `DATABASE_URL`.
- Copy the direct or session-pooler Postgres connection string into
  `DIRECT_DATABASE_URL` only when Vercel can reach it reliably.
- Use the Supabase project URL for `NEXT_PUBLIC_SUPABASE_URL`.
- Use the Supabase publishable/anon key for
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Create a private Supabase Storage bucket for temporary PAP files.
- Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_PRIVATE_BUCKET` for
  server-side private storage. Do not expose the secret key to the browser.
- When `DIRECT_DATABASE_URL` is configured, the Vercel build command runs
  `prisma migrate deploy` before building so the deployed API and production
  database schema stay aligned.

Recommended launch gate:

- `APP_ACCESS_USER`
- `APP_ACCESS_PASSWORD`

Optional AI extractor variables:

- `OPENAI_API_KEY`
- `OPENAI_EXTRACTOR_MODEL`

PAP production variables:

- `NEXT_PUBLIC_PAP_PUBLIC_URL`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_PRIVATE_BUCKET`

Use `.env.example` as the template for local and deployment values. Never commit
real secrets.

## Launch Security

When `APP_ACCESS_PASSWORD` is set, the app requires HTTP Basic Auth before
rendering private workspace pages or API routes. Phone Transfer uses the same
gate; any trusted device can upload to and view the shared inbox after signing
in.

The app also sends baseline browser security headers from `next.config.ts` and
validates upload file type and size at extractor and automation batch entry
points.

Rate limits are implemented in-process for launch protection on write-heavy
routes. For public or higher-traffic deployments, add an edge/managed rate limit
service because serverless instances do not share in-memory counters.

Content Security Policy is enabled in `next.config.ts`. It currently allows
inline scripts/styles for compatibility with Next.js and permits `ws:`/`wss:`
connections for PAP signaling.

## Health Check

Use `/api/health` after deployment. It checks environment configuration and a
database round trip. The route returns `503` when configuration or database
connectivity is broken.

## Persistent Upload Storage

Persistent service asset uploads are deprecated for phase 1. The app should not
act as a long-term asset archive because the church production desktop remains
the source of truth for stored media.

PAP is a temporary bridge: receive files into a protected global inbox, download
or batch download from any trusted device, then delete or let the uploads expire.
Production deployments should use the Supabase Storage-backed private storage
adapter for these temporary files.

Generated automation outputs may still use local file output during development.
Before relying on generated output persistence in production, either move those
outputs to database-backed records or add a storage adapter.

## PAP Global Inbox

The current PAP phone-transfer workflow uses one protected temporary inbox for
the site instead of QR pairing, copied links, WebRTC signaling, or public room
tokens. Upload, list, download, and delete actions require the normal app access
gate.

Uploads are stored as private files and metadata rows. Room-token tables remain
available as implementation storage, but the active user flow is the global
temporary inbox.
