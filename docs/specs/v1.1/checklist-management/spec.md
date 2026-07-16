# Centralized Checklist Management Spec

**Status:** Implemented; pending review
**Release:** 1.1

## Purpose

Make Settings the only checklist editing surface and show the configured active
items on the Dashboard as a read-only booth reference.

## Source of Truth

- `ChecklistItemPreset` remains the persisted workspace-level configuration.
- `/api/settings/checklist-items` remains the read/write API.
- Settings owns create, rename, implicit top-to-bottom order, active state, and
  delete actions.
- Dashboard reads the same records and never keeps a second hard-coded list.

## Dashboard Behavior

- Show only active items.
- Sort by `order`; use stable record order when values match.
- Render items as a numbered reference list, not interactive checkboxes.
- Keep the existing expand/collapse control.
- A zero-item state says that no active checklist items are configured and links
  to Settings.
- An API failure shows an unavailable state and Retry; it must not silently show
  a stale hard-coded fallback as if it were current.
- Returning to Dashboard after a successful Settings change must show the latest
  checklist data through the shared TanStack Query cache/refetch behavior.

## Settings Behavior

- Existing checklist validation remains: non-empty label, maximum 120
  characters, non-negative integer order, and active state.
- The numeric order value remains internal; users understand sequence from the
  visible top-to-bottom list.
- Default items remain protected from deletion but may be edited or deactivated
  under the existing contract.
- Saving a change invalidates the checklist query.
- No per-service completion state is stored in 1.1.

## Accessibility and UI

- The Dashboard list uses ordered-list semantics.
- Expand/collapse exposes `aria-expanded` and remains keyboard operable.
- Empty and error states use text, not color alone.
- The Dashboard remains read-only and scan-first under booth pressure.

## Acceptance Criteria

- Changing an active item label in Settings changes the Dashboard label after
  cache refresh/refetch.
- Deactivating an item removes it from the Dashboard without deleting it.
- Ordering changes are reflected on the Dashboard.
- Dashboard contains no duplicate checklist constant.
- Dashboard offers no checklist editing or completion controls.
- Empty and unavailable states are distinct.

## Out of Scope

- Per-service checklist completion.
- Completion history or audit logs.
- Reminders, notifications, assignments, or due dates.
- Multiple checklist sets or conditional checklist logic.
