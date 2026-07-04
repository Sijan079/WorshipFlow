# TODO

## Background Generator

- Review whether legacy filesystem-backed generated background records should be
  purged automatically when they fail to open on hosted deployments.
- Decide whether to add an admin-only cleanup action for stale generated output
  rows that still point to local filesystem paths.
- Revisit storage diagnostics once the hosted environment is stable and reduce
  log verbosity if the current signals are no longer needed.

## Documentation

- Keep feature docs aligned with the active image-only background generation
  workflow whenever provider, stage flow, or retention policy changes.
- Add a short operator runbook for troubleshooting `private-output-storage`
  runtime logs in hosted environments.

## Audits

- Security audit: review auth boundaries, route protection, file access flows,
  Supabase secret handling, rate limiting, and generated-output access controls.
- Performance optimization audit: review background generation UX latency,
  preview/download responsiveness, query invalidation behavior, and storage I/O
  paths across local and Vercel environments.
