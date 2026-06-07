# Service Flow Spec

## Purpose

Service Flow manages worship service preparation in the approved block order.

## Scope

- Worship service CRUD.
- Strict ordered service block rendering.
- Participant assignment.
- Song assignment to service blocks.
- Service review in stored block order.

## Domain Rules

- `WorshipService` represents one real worship service.
- Block order is invariant.
- `AWIT_NG_PAKIKINIG` stays before `SCRIPTURE_READING`.
- `AWIT_NG_PAGTUGON` stays after `SERMON`.
- UI must never present alternate block sequences.

## Out Of Scope

- General event management.
- Recurring events.
- Chat, notifications, or social features.
- Complex RBAC.
- Persistent service asset archives or future-reference file attachments.
