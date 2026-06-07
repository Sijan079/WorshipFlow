# Vercel Deployment

## Deployment Checklist

- Create a production PostgreSQL database.
- Configure all required Vercel environment variables.
- Set `APP_ACCESS_PASSWORD` for both Preview and Production.
- Confirm `npm run build` passes locally.
- Confirm production migrations are ready with `prisma migrate deploy` before
  promoting a database-backed deploy.
- Deploy from the repository root with the Next.js preset.
- Visit `/api/health` after deploy and confirm `ok: true`.
- Test service creation, Song Formatter, and Media Tools.
- Do not consider PAP phone transfer production-ready until a public `wss://`
  signaling service is configured.

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
- `DIRECT_DATABASE_URL`

For Supabase Postgres, use the Supabase pooled connection string for
serverless/Vercel deployments. Prisma continues to read the database through
`DATABASE_URL`; no ORM change is required.

Use `DIRECT_DATABASE_URL` for Prisma migrations. Supabase's transaction pooler
can fail migration commands with prepared-statement collisions, so migrations
should use the direct database host instead.

Supabase setup:

- Create a Supabase project.
- Copy the pooled Postgres connection string into `DATABASE_URL`.
- Copy the direct Postgres connection string into `DIRECT_DATABASE_URL`.
- Use the Supabase project URL for `NEXT_PUBLIC_SUPABASE_URL`.
- Use the Supabase publishable/anon key for
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Do not expose the Supabase service-role key to the browser.
- The Vercel build command runs `prisma migrate deploy` before building, so the
  deployed API and production database schema stay aligned.

Recommended launch gate:

- `APP_ACCESS_USER`
- `APP_ACCESS_PASSWORD`

Optional AI extractor variables:

- `OPENAI_API_KEY`
- `OPENAI_EXTRACTOR_MODEL`

PAP production variables:

- `NEXT_PUBLIC_PAP_PUBLIC_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Local PAP WebSocket fallback:

- `NEXT_PUBLIC_PAP_SIGNALING_URL`

Use `.env.example` as the template for local and deployment values. Never commit
real secrets.

## Launch Security

When `APP_ACCESS_PASSWORD` is set, the app requires HTTP Basic Auth before
rendering private workspace pages or API routes. The phone-transfer join page
under `/pap/join/*` remains open so QR pairing still works from a mobile device.

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

PAP is a temporary bridge: receive files, rename if needed, download or batch
download, then clear the inbox. Supabase Storage is not required for that flow.

Generated automation outputs may still use local file output during development.
Before relying on generated output persistence in production, either move those
outputs to database-backed records or add a storage adapter.

## Realtime / PAP Signaling Options

Vercel should host the web app. PAP signaling can use Supabase Realtime
Broadcast when `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set.

The local Node WebSocket signaling server remains available as a development
fallback when Supabase Realtime variables are not configured.

Supabase Realtime signaling is used only for pairing and WebRTC negotiation.
PAP image bytes still transfer directly over WebRTC and remain temporary in the
desktop browser inbox.

## PAP Signaling

The current PAP phone-transfer workflow can use Supabase Realtime Broadcast for
the signaling step. The fallback local WebSocket server is still useful for LAN
testing.

## TURN

For reliable WebRTC across mobile networks and strict NAT environments, add a
TURN provider or self-hosted TURN server before relying on PAP transfer in
production.
