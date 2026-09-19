# Vercel Deployment

## Deployment Checklist

- Create a production PostgreSQL database.
- Configure all required Vercel environment variables.
- Set the Supabase Auth variables for both Preview and Production.
- Confirm `npm run build` passes locally.
- Configure `DIRECT_DATABASE_URL` for production. The deployment runs
  `prisma migrate deploy` first and stops if the migration fails.
- Deploy from the repository root with the Next.js preset.
- Visit `/api/health` after deploy and confirm `ok: true`.
- Test service creation, Song Formatter, and Media Tools.
- Test PAP phone transfer by uploading from phone, viewing from desktop, and
  downloading or deleting from the shared inbox.
- Test Background Generator by validating an estimate, generating an image,
  previewing it, and downloading it from the output surface.

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

Use `DIRECT_DATABASE_URL` for Prisma migrations with a direct or migration-safe
connection reachable from the build environment. Production deployments must
set it so the deployed API cannot run against an older schema.

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
- Create a private Supabase Storage bucket for temporary PAP files and generated
  workspace background assets.
- Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_PRIVATE_BUCKET` for
  server-side private storage. Do not expose the secret key to the browser.
- When `DIRECT_DATABASE_URL` is configured, the Vercel build command runs
  `prisma migrate deploy` before building so the deployed API and production
  database schema stay aligned.

Supabase Auth variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_URL`

Optional AI extractor variables:

- `OPENAI_API_KEY`
- `OPENAI_EXTRACTOR_MODEL`

Optional observability variables:

- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`

Set the metrics endpoint to an OTLP/HTTP `v1/metrics` endpoint when custom
failure counters and histograms should be retained outside Vercel runtime logs.
Standard `OTEL_EXPORTER_OTLP_HEADERS` configuration is supported by the
OpenTelemetry exporter when the destination requires authentication.

PAP production variables:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_PRIVATE_BUCKET`

Use `.env.example` as the template for local and deployment values. Never commit
real secrets.

## Launch Security

Google OAuth is configured in Supabase Dashboard → Authentication → Providers →
Google. Keep the downloaded `client_secret*.json` file local and ignored. Do not
put the Google client secret in Vercel environment variables or any
`NEXT_PUBLIC_*` variable; rotate it in Google Cloud Console if it was exposed.

Supabase Auth owns the session cookie and the app enforces workspace membership
inside its server routes.

Phone Transfer uses the same login gate; any trusted device can upload to and
view the shared inbox after signing in.

The app also sends baseline browser security headers from `next.config.ts` and
validates upload file type and size at extractor and automation batch entry
points.

Rate limits are implemented in-process for launch protection on write-heavy
routes. For public or higher-traffic deployments, add an edge/managed rate limit
service because serverless instances do not share in-memory counters.

Content Security Policy is enabled in `next.config.ts`. It currently allows
inline scripts/styles for compatibility with Next.js.

## Formatter Draft Cleanup

Deploy migrations `20260918000000_temporary_formatter_drafts` and
`20260918001000_secure_formatter_drafts` before the new
formatter API. Provision a scheduler that supports a five-minute cadence before
rolling out cross-device drafts. Configure `FORMATTER_CLEANUP_SECRET` to a random
secret of at least 32 characters in the app and scheduler; never expose it to
the browser or put it in a URL.

The scheduler must POST to `/api/internal/formatter-cleanup` every five minutes
with `Authorization: Bearer <secret>`. This exact endpoint bypasses the login
redirect but verifies its secret in the handler. It returns `{ removed: number }`,
401 for bad credentials, and 503 for missing configuration or database failure.
Alert on failed/missed runs and verify a disposable expired draft is removed
without opening the formatter. No production scheduler is created by this repo.

Alternatively, a Node host with the same database can schedule
`node --experimental-strip-types scripts/cleanup-formatter-drafts.ts` using its
process scheduler. `npm run dev` starts the local runner automatically.
The operation is idempotent and removes up to 500 expired drafts per invocation;
run again if the result is 500 to drain a backlog. Editing stops at expiry even
if cleanup is delayed. Database backups follow the database provider's existing
retention policy; deleting live rows is not a promise to erase historical backups.

Verify production membership/ownership rejection, two-device takeover, expiry,
and cleanup before release. Do not treat an unconfigured scheduler as ready.

## Health Check Endpoint

Use `/api/health` with an authenticated application session after deployment.
It checks environment configuration and a database round trip. The route returns
`401` without a session and `503` when configuration or database connectivity
is broken.

## Error Observability

The September 19 health check upgraded Next.js and its ESLint configuration to
16.3.5 and applied compatible dependency security patches. Four high audit
findings remain in the Prisma 6.19 CLI dependency chain (`@prisma/config`,
`deepmerge-ts`, and `effect`). Reassess these during a dedicated Prisma upgrade;
the suggested automated downgrade to 6.12 is incompatible with the current pin.
These dependencies are used by build/migration tooling, but npm also includes
them in its production audit through the Prisma Client optional peer.

The app registers OpenTelemetry from `src/instrumentation.ts`. Unhandled Next.js
server errors and caught route-handler failures emit:

- structured runtime logs with an event name, route, HTTP status, request ID,
  and the active trace/span IDs;
- the `worship_flow_failures_total` counter, grouped only by low-cardinality
  event, route, and status attributes;
- the `worship_flow_failure_duration_ms` histogram when an operation supplies
  elapsed time;
- exceptions and failure attributes on the active request trace.

Error messages are capped at 500 characters, with email addresses, bearer
tokens, and URL credentials redacted before logging or adding them to spans.
The reporter does not attach request bodies, lyrics, authentication headers,
or user profiles. Error messages still need care at their source: pattern-based
redaction cannot guarantee removal of arbitrary private text or secret formats.

Before production launch, configure a Vercel Observability Drain for retained
logs and traces. Configure `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` when custom
metrics must be exported to an OTLP-compatible destination; without it, the
same failure counter event remains present in structured runtime logs. Alert on
sustained server failures, health check failures, and formatter draft failures.
Keep the route and event attributes bounded; never add workspace IDs, song
titles, emails, or request IDs as metric labels.

## Persistent Upload Storage

Persistent service asset uploads are deprecated for phase 1. The app should not
act as a long-term asset archive because the church production desktop remains
the source of truth for stored media.

PAP is a temporary bridge: receive files into a protected global inbox, download
or batch download from any trusted device, then delete or let the uploads expire.
Production deployments should use the Supabase Storage-backed private storage
adapter for these temporary files.

Generated backgrounds and PAP temporary assets now use the private output
storage adapter. In production, that adapter should be backed by Supabase
Storage so serverless runtimes do not depend on local filesystem persistence.

When debugging generated background preview or download issues, look for the
private output storage diagnostics in runtime logs:

- `private-output-storage save`
- `private-output-storage read`
- `private-output-storage delete`

Healthy production background records should log `storageMode: 'supabase'`.
Legacy records from older deploys may still log `storageMode: 'filesystem'` and
fail on Vercel because local files are not durable across serverless requests.

## PAP Global Inbox

The current PAP phone-transfer workflow uses one protected temporary inbox for
the site instead of QR pairing, copied links, WebRTC signaling, or public room
tokens. Upload, list, download, and delete actions require the normal app access
gate.

Uploads are stored as private files and metadata rows. Room-token tables remain
inbox-specific through `PAPInboxScreenshot`; the legacy room-token and signaling
tables are no longer part of the active PAP schema.

If Phone Transfer returns a storage-unavailable response in a deployed
environment, verify that the latest PAP migration has been applied to the
connected database:

```sql
SELECT migration_name, finished_at
FROM "_prisma_migrations"
WHERE migration_name = '20260617000000_remove_legacy_pap_runtime';
```
