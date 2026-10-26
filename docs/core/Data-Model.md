# Data Model

Baseline: 2026-10-26, revised same day (see `docs/changes/20261026.md`).
Later changes are recorded in `docs/changes/YYYYMMDD.md`.
Prisma (`prisma/schema.prisma`) is the source of truth; this document records
intent and the decisions behind schema changes.

## New models

### Person (workspace-scoped)

- `name`, `status` (VISITOR, REGULAR, MEMBER, INACTIVE, ARCHIVED; default REGULAR).
- `gender`: optional (MALE, FEMALE), carried over from the old servant roster.
- `birthdate`: optional full date.
- `baptismStatus`: BAPTIZED, NOT_BAPTIZED, UNKNOWN.
- `baptismDate`: allowed only when `baptismStatus` is BAPTIZED; null otherwise.
  BAPTIZED with a null date is valid (known baptized, date unknown).
  Enforce with Zod and a database check constraint.
- `createdBy`, `updatedBy` and timestamps (see Access-and-Privacy).
- No other fields until a feature needs them. Candidates later: phone, address,
  household.
- No link to `User`. Accounts are tech-team accounts only.
- Moving to another church means status ARCHIVED (or INACTIVE), which is
  reversible and keeps history. Hard delete is Owner/Admin only.

### Ministry (workspace-defined)

- One list that replaces both `MinistryPreset`/`AssignedMinistry` (which ministry
  runs a service) and `ServantGroupPreset`/`ServantGroup` (roster grouping,
  including Tech, Music, Pastors).
- A person can belong to many ministries (a link table, `PersonMinistry`). The
  People form shows ministries as a checklist, and the ledger lists the chosen
  ones. A service's "assigned ministry" points at this same list at step 3.
  Optional leader per ministry.
- Seeded per workspace: Church Leaders, Pastors, Men's, Ladies', Youth, Tech,
  Music, Mixed. The old service code LEADERS and the roster code CHURCH_LEADERS
  are the same ministry. Mixed has no members; it exists so the services that
  use it keep their label. Built in step 1 (see `src/lib/ministries.ts`).
- Per-service roles (who does what in one service) stay as assignments on the
  service.

### Site (public church website)

- `SiteSettings`: one per workspace. Includes `indexable` (default false),
  logo, color and font preset, contact details.
- `Page`: title, slug unique per workspace, status (DRAFT, PUBLISHED),
  `isPublic`, sort order for navigation.
- `PageBlock`: belongs to a page, ordered, typed (heading, rich text, image,
  button, announcements list, events list, service times, contact). Content is
  structured data, never raw HTML. Rich text is a restricted ProseMirror subset.
- `Post`: title, slug, body (rich text), publish date, status, `isPublic`.
- Image blocks reference files in Supabase Storage and count toward the
  workspace storage meter.

## Changed models

- `Servant` is replaced by `Person` plus Ministry membership, **without a data
  migration**: the roster is entered fresh on the People screens at step 3. Until
  then Teams and the service pickers keep using `Servant`. The old table stays
  until step 8.
- `ServiceServantAssignment` and `BlockPerson` store `personName` text, not a
  link to a servant. Step 1 adds an optional `personId` to both and keeps
  `personName` as the record of who served. Linking happens at step 3, if wanted,
  by exact name match once the roster exists.
- `ChurchEvent`: remove `recurrence` (`EventRecurrenceKind`) and the `weekly*`
  fields. Replace with a repeat rule: NONE, DAILY, or WEEKLY with selected
  weekdays, plus an end (a date, or never). Add `isPublic`.
- `ChurchEventOccurrence`: stays a real row per date. Every event has a start and
  end and may span several days. Editing or cancelling one occurrence changes
  only that date. Changing the series regenerates only future occurrences that
  have not been individually edited. For "never" series, keep only the next
  4 months of occurrences; extend as time passes.
- Remove `EventVisitor` (superseded by Person with status VISITOR) and
  `EventRegistrationProvider` (the registration link stays as a plain URL).
- `WorshipService`: add optional `headcount` (nullable integer).
- `ChurchEventOccurrence.attendanceCount` stays as the optional per-occurrence
  headcount.
- `EventAnnouncement` becomes a church-wide `Announcement`: title, body, optional
  event link, status (DRAFT, PUBLISHED), start and end dates, `isPublic`, plus
  plain text fields for Facebook and Instagram copy.
- `WorkspaceModule` enum: add PEOPLE, SITE (plus MINISTRIES if given its own
  grants). Site actions add PUBLISH to the existing action list.
- A keep-alive record (for example a single-row heartbeat table) that the daily
  cron writes to. It holds no church data.

## Unchanged

WorshipService, blocks, templates, program block types, songs, tags, checklists,
assets, automation jobs, generated outputs, caption models, workspace membership
and invitations, integrations, error notifications.

## Migration order

1. Person and Ministry (additive).
2. Servant to Person and Ministry migration with dry-run.
3. PEOPLE permission enum and grants.
4. Event repeat rule and occurrence changes; service headcount.
5. Announcement, with `isPublic`.
6. Site models and the SITE permission enum.
7. Keep-alive heartbeat table.
8. Remove superseded tables and enums only after nothing references them.
