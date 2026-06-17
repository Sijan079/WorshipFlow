# Performance and Security Audit

Date: June 17, 2026

## Scope

- Auth boundaries and route protection
- Generated-output access controls
- PAP phone-transfer routes
- Private storage handling
- Background generation latency and cleanup behavior
- In-process rate limiting

## Status Update

Follow-up implementation work has now retired the legacy PAP signaling and
room-token runtime paths, standardized Phone Transfer on the shared protected
inbox workflow, and applied the required `PAPInboxScreenshot` migration in the
active Supabase database. The original findings below are kept as a historical
record of the audit state on June 17, 2026.

## Findings

### P1

- Unauthenticated PAP signaling is still present in the codebase at
  `/api/pap/signaling/[pairingCode]`, but it is not part of the active Phone
  Transfer workflow anymore.
- The active flow already matches the current product direction:
  signed-in devices upload to the shared protected inbox at `/api/pap/uploads`,
  and signed-in users on the site can view, download, and delete from that same
  inbox.
- Evidence:
  - [spec](C:/projects/worship_flow/docs/specs/media-tools/phone-transfer/spec.md:1)
  - [src/features/pap/hooks/use-pap-mobile-sender.ts](C:/projects/worship_flow/src/features/pap/hooks/use-pap-mobile-sender.ts:21)
  - [src/features/pap/hooks/use-pap-desktop-session.ts](C:/projects/worship_flow/src/features/pap/hooks/use-pap-desktop-session.ts:24)
- Conclusion:
  - The earlier P1 risk does not apply to the current demo path as the primary
    user flow.
  - The signaling route is now legacy surface area and should either stay gated
    behind normal app auth or be retired in a later cleanup pass.

### P2

- The PAP diagnostics route was publicly exempted from the access gate even
  though the current phone-transfer flow is intended for signed-in users only.
- The in-memory rate limiter did not evict expired buckets, so long-running
  processes could accumulate stale keys.
- Several request-path cleanup/bootstrap concerns remain, especially around
  request-time PAP table bootstrapping and synchronous retention cleanup for
  background outputs, but those were not changed in this pass because they need
  a broader workflow decision.

## Changes Applied

- Removed the proxy public-route exemption for `/api/pap/diagnostics`.
- Removed the proxy public-route exemption for `/api/pap/signaling/`.
- Added regression coverage confirming those PAP routes are no longer treated as
  public launch-gate exceptions.
- Extracted rate-limit bucket storage into a framework-free helper and added
  eviction of expired buckets on each check.
- Added regression coverage confirming expired rate-limit buckets are pruned.
- Updated local development docs to mark PAP signaling as legacy rather than the
  active phone-transfer path.

## Residual Risks

- PAP inbox APIs depend on the `PAPInboxScreenshot` table being present in the
  connected database. If a new environment misses the
  `20260617000000_remove_legacy_pap_runtime` migration, PAP should now degrade
  with a storage-unavailable response instead of a generic 500, but uploads and
  inbox listing will not function until the migration is applied.
- Background retention cleanup still runs inline on user-facing background list
  and generate requests.
- Rate limiting is still in-process only, so it remains weak across multiple
  serverless instances. That is acceptable for the current single-team demo
  posture, but it is not strong shared-infrastructure protection.

## Verification

- `npm test`
