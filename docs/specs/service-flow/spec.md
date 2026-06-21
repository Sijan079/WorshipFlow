# Service Flow Spec

## Purpose

Service Flow manages worship service preparation in the approved block order.

## Scope

- Worship service CRUD.
- Compact services table for scan-first review.
- Strict ordered service block rendering.
- Participant assignment.
- Song assignment to service blocks.
- Service review in stored block order.
- Paste-based WS participant/details parsing into service forms.

## Domain Rules

- `WorshipService` represents one real worship service.
- Block order is invariant.
- `AWIT_NG_PAKIKINIG` stays before `SCRIPTURE_READING`.
- `AWIT_NG_PAGTUGON` stays after `SERMON`.
- UI must never present alternate block sequences.
- Service list rows are `checkbox | date | ministry | sermon verse | expand`.
- Row-level editing is only exposed from the expanded details area, not the collapsed row.
- Expanded row styling overrides checkbox-selected styling.
- Offering remains one stored servant assignment role, but the create/edit form captures two offering people and stores them as a single joined value.
- Hymnal parser input like `Song Title, p.44` is normalized to `044 - Song Title`.

## Out Of Scope

- General event management.
- Recurring events.
- Chat, notifications, or social features.
- Complex RBAC.
- Persistent service asset archives or future-reference file attachments.

## Implementation Notes

- Initial services data is server-fetched for faster first load, then hydrated into the client workspace.
- Services list payloads should stay minimal and avoid returning service blocks, jobs, or outputs unless the screen actually needs them.
- API 500 responses for service list/create flows should not expose raw internal error messages to the browser.
