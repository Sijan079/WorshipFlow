# Design - Worship Production OS

This repository follows the Stitch MCP project **Worship Production OS**
(`13697574181324164099`). The active design system is **Production Grade
Interface**. If older local guidance conflicts with it, prefer the Stitch
source.

## Design Goal

The UI should help a worship and production team understand, at a glance:

- What service they are working on
- What comes next in the service flow
- What still needs attention before live execution

Every layout, component, and transition should reduce hesitation under
pressure, not add personality for its own sake.

## Anti-AI-Slop Redesign Rule

Every redesign starts with the operator's real task, the existing information
architecture, and live domain data. It should feel purpose-built for worship
service preparation, not assembled from a generic SaaS dashboard recipe.

- Do not add workflow heroes, decorative gradients or glow, fake metrics,
  placeholder analytics, ornamental status dots, filler copy, or badge spam.
- Do not default to equal card grids when a list, description group, or
  deliberate hierarchy communicates the information more directly.
- Do not repeat eyebrow labels, headings, and descriptions that say the same
  thing.
- Use semantic tokens instead of introducing one-off colors, shadows, or
  radii.
- Keep motion functional and restrained. A transition must explain a state or
  spatial change.
- Treat loading, empty, error, keyboard, focus, mobile, and reduced-motion
  behavior as part of the design, not as cleanup.
- Preserve domain language and strict stored service order. Visual novelty
  never outranks operational clarity.

## Brand Direction

- Dark, focused production-OS feel for live worship preparation
- Calm, readable, authoritative surfaces under pressure
- Cinematic only where it improves clarity, never at the cost of speed
- Prioritize service order accuracy, operator speed, and fast recognition

## Motion Principles

Motion is a communication layer, not decoration.

- Stack: Next.js 16, React 19, Tailwind CSS 4, TypeScript
- Use CSS and Tailwind transitions for hover, focus, pressed states, loading
  indicators, and simple entrances
- Use Motion for React only for expand, reorder, and enter or leave behavior
- Consider native browser or Next.js View Transitions later for major
  page-to-page navigation
- Animate primarily with `transform` and `opacity`
- Most interactions: 120-240ms
- Larger panels: up to 320ms
- No bounce effects
- Keep button scaling between `0.97` and `1.01`
- No large staggered entrances for routine content
- Do not animate information users are urgently trying to read
- Motion must never delay saving, navigation, form submission, or live output
- Use movement to show where an item came from and where it went
- Respect reduced motion globally; use `useReducedMotion()` for JS-driven motion

## Tokens

`tokens.css` is the canonical editable token source.

- Base palette variables use `--palette-*`
- Semantic UI intent uses `--surface-*`, `--text-*`, `--border-*`,
  `--action-*`, `--state-*`, `--radius-*`, and `--elevation-*`
- `src/app/globals.css` is the semantic application layer
- Older `--color-*` names may remain temporarily as migration aliases
- New UI work should prefer semantic tokens directly

## Palette

Use this Stitch palette:

- `surface`: `#0b1326`
- `surface-dim`: `#0b1326`
- `surface-bright`: `#31394d`
- `surface-container-lowest`: `#060e20`
- `surface-container-low`: `#131b2e`
- `surface-container`: `#171f33`
- `surface-container-high`: `#222a3d`
- `surface-container-highest`: `#2d3449`
- `on-surface`: `#dae2fd`
- `on-surface-variant`: `#ccc3d8`
- `outline`: `#958da1`
- `outline-variant`: `#4a4455`
- `surface-tint`: `#d2bbff`
- `primary`: `#d2bbff`
- `on-primary`: `#3f008e`
- `primary-container`: `#7c3aed`
- `on-primary-container`: `#ede0ff`
- `secondary`: `#89ceff`
- `secondary-container`: `#00a2e6`
- `tertiary`: `#ffb2b7`
- `tertiary-container`: `#c81a42`
- `error`: `#ffb4ab`
- `error-container`: `#93000a`
- `background`: `#0b1326`
- `surface-variant`: `#2d3449`

## Semantic Roles

Components should consume tokens by intent, not raw color family.

- Surfaces: `--surface-canvas`, `--surface-panel`, `--surface-panel-alt`,
  `--surface-panel-strong`, `--surface-panel-elevated`, `--surface-overlay`,
  `--surface-overlay-strong`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`,
  `--text-inverse`, `--text-accent`, `--text-destructive`
- Borders and rules: `--border-default`, `--border-strong`,
  `--border-focus`, `--rule-subtle`, `--rule-strong`
- Actions and states: `--action-primary-bg`, `--action-primary-bg-hover`,
  `--action-primary-ink`, `--state-success`, `--state-warning`,
  `--state-danger`, `--state-live`, `--state-ready`, `--state-idle`
- Shape: `--radius-control`, `--radius-card`, `--radius-container`,
  `--radius-pill`
- Elevation: `--elevation-none`, `--elevation-subtle`,
  `--elevation-raised`, `--elevation-modal`

## Typography

- Inter for display and body
- Geist for labels, metadata, timestamps, codes, and technical readouts
- `display-lg`: 48/56, 700, `-0.02em`
- `headline-lg`: 32/40, 600, `-0.01em`
- `headline-md`: 24/32, 600
- `body-lg`: 18/28, 400
- `body-md`: 16/24, 400
- `label-md`: 14/20, 500, `0.02em`
- `label-sm`: 12/16, 500, `0.05em`

## Layout

- Desktop: persistent 280px left OS rail, 12-column content grid, 24px
  margins, 16px gutters
- Tablet: 8-column grid, 16px margins, 16px gutters
- Mobile: 4-column grid, 16px margins, 12px gutters, compact workflow nav
- Inspector panels: 320px when present
- Base spacing unit: 8px
- Large high-pressure work areas should keep at least 32px safe areas

## Surfaces and Shape

- Level 0 canvas: `#0b1326`
- Level 1 containers: `#171f33` with a subtle outline
- Level 2 active or floating surfaces: `#222a3d` or `#2d3449`
- Shadows should stay tight and low-opacity
- Purple ambient shadow is allowed only when active separation needs to read
- Chips and badges: 4px radius
- Standard buttons, inputs, and cards: 8px radius
- Large containers and modals: 12px radius

## Component Direction

- Primary buttons: electric purple or `primary-container` fill with high
  contrast text
- Secondary buttons: transparent or dark ghost surface with a 1px slate border
- Inputs: darker than surrounding surfaces, etched appearance, purple focus
- Technical buttons: compact Geist labels
- Service cards: drag handle where ordering exists; active item may use a 4px
  primary stripe
- Status indicators: saturated pips for Live, Ready, Idle, and alert states
- Inspector panels: right-aligned, compact, and data-dense

### Settings Collection Actions

- Each settings section owns one Save action in its section header; do not place Save buttons on individual collection rows.
- Hide the section Save action until that section contains unsaved changes; hide it again when changes are saved or reverted.
- Each settings section places its Add action beside the section heading; do not append an inline add row or trailing add button to the collection.
- Opening Add may reveal a compact creation form directly below the section header.
- Keep row actions limited to operations that affect only that row, such as status, expand, reorder, or delete.

## Screen Set

The app should continue mapping Stitch workflows into:

- Service Flow Hub
- Worship Song Formatter - Landing
- Worship Song Formatter - Interactive Editor
- Worship Song Library
- Production Media Tools
- Live Sermon Captions & Translation
- Design System

## Exports

Keep `tokens.css` aligned with this design system and keep `src/app/globals.css`
aligned as the semantic UI contract layer.
