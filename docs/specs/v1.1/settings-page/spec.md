# Settings Page Restructure Spec

**Status:** Implemented; pending review
**Release:** 1.1

## Purpose

Replace the current long Settings page with four focused tabs while preserving
all existing settings behavior.

## Information Architecture

| Tab | Contents |
| --- | --- |
| General | Workspace operational status, ministries, servant groups, AI usage availability, current access mode, and AI integration status |
| Templates | Worship service templates and their stored block order |
| Tags | Song tag presets |
| Checklist | Pre-service checklist presets |

General is the default tab. Tab state does not require a new route or persisted
preference in 1.1.

## Functional Requirements

- Render one tab panel at a time.
- Preserve create, update, activate/deactivate, and delete behavior already
  supported by each settings section.
- Preserve default-record deletion protection.
- Keep service-template blocks in their stored order.
- Keep preset codes internal and generate them from labels for new records.
- Show service templates as collapsed rows with the template name beside the
  disclosure icon; reveal editing controls only when expanded.
- Present checklist sequence by top-to-bottom position without a numeric order
  field.
- Keep the existing Refresh action; it refreshes settings data without changing
  the selected tab.
- A failure in one settings collection must identify the affected section and
  must not make unrelated tabs appear empty.
- Do not add autosave; existing explicit save behavior remains.

## Interaction and Accessibility

- Use the tab pattern: `tablist`, `tab`, and `tabpanel` semantics.
- The active tab is visually distinct without relying on color alone.
- Left/Right Arrow moves between tabs; Home/End moves to the first/last tab.
- Focus remains visible and moves predictably when a tab is selected.
- On narrow screens, tabs may horizontally scroll; labels must not truncate into
  ambiguity.
- Reuse existing semantic tokens, panels, controls, and 120–240 ms CSS
  transitions. No new motion dependency or decorative animation.

## Data and Architecture

- Reuse the current settings endpoints and TanStack Query records.
- No Prisma schema change is required for the tab restructure.
- No generic settings registry or plugin architecture is required.
- Existing query keys remain the cache contract.

## States

- Loading: show a compact panel-level loading state.
- Error: name the section that failed and offer Retry.
- Empty: keep the section heading and show its existing add control.
- Saving/deleting: disable the affected action and show progress without locking
  unrelated tabs.

## Acceptance Criteria

- All current Settings sections appear under the mapped tab.
- Selecting tabs never discards unsaved field text during the same page visit.
- A keyboard-only user can reach, select, and operate every tab.
- Template editing preserves strict block order.
- Collapsed templates expose only their name and current active state.
- No settings endpoint or persistence contract changes solely for navigation.

## Out of Scope

- Search across settings.
- User-customizable tab order.
- Deep links to individual tabs.
- New settings categories beyond the 1.1 plot.
