# Events Foundation Spec

## Purpose

Events coordinates church activities outside the worship-service flow. A
`ChurchEvent` never replaces or modifies a `WorshipService`.

## Current release

- `/w/{workspaceSlug}/events` opens a month calendar by default; List is a secondary view.
- An authorized member can view dated event occurrences in their workspace.
- Owner/Admin, or a Member permitted by the `EVENTS.CREATE` Member default or
  personal setting, can
  create a one-time event with title, date, start/end time, venue, description,
  and optional external registration form URL.
- Overlapping event times appear as advisory warnings. Creation remains allowed.
- Registration remains optional. The app does not host a public event or signup page.
- Event details show response and attendance counts if they have been recorded;
  this release does not synchronize or edit those counts.
- A calendar with no events shows an empty state, not sample records.

## Persistence and access

The additive Prisma migration introduces `ChurchEvent`,
`ChurchEventOccurrence`, `EventVisitor`, `EventAnnouncement`, and
`WorkspaceActionGrant`. A follow-up migration adds `WorkspaceRoleActionDefault`
and allow/block personal settings. New public-schema tables have RLS enabled and
no browser Data API policies. Route handlers verify active membership and exact
event actions. Owner/Admin always have full Events access. The Membership tab
lets an Owner/Admin set Member defaults and personal exceptions for Events View
and Create. Existing role assignments remain in place; existing personal grants
remain allowed. Other workspace modules keep their existing role checks until
their action-specific APIs are implemented.

## Deferred

Weekly recurrence behavior, changing or cancelling one occurrence, attendance
entry, visitor names, form templates and response sync, announcement editing,
Facebook/Instagram publishing, and permissions for those future actions need separate
behavior designs and checks. The product direction and visual rationale are in
[the Events foundation design](../../planning/issue-6/2026-10-24-events-foundation-design.md).
