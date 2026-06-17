# Design - Worship Production OS

This repository follows the Stitch MCP project **Worship Production OS**
(`13697574181324164099`). The active design system is **Production Grade
Interface**. Older local design rules are deprecated when they conflict with
this Stitch source.

## Brand & Style

The interface is designed for live worship production and service preparation.
It should feel like a focused operating system for a production booth: dark,
clear, authoritative, and calm under pressure.

Use a modern dark-mode style with deep charcoals, precision indigos, electric
purple actions, atmospheric blue technical states, and red alert states. The UI
may feel cinematic and immersive where the workflow benefits from it, but it
must still prioritize readability, service order accuracy, and operator speed.

## Token Architecture

The token system is intentionally two-layered:

- `tokens.css` is the canonical editable token source.
- The base palette layer holds raw brand, neutral, and state colors as
  `--palette-*` variables.
- The semantic layer sits on top of the palette and defines UI intent through
  `--surface-*`, `--text-*`, `--border-*`, `--action-*`, `--state-*`,
  `--radius-*`, and `--elevation-*`.
- `src/app/globals.css` is the semantic application layer. It maps global UI
  affordances and shared utility classes such as panel, button, modal, and
  technical-label treatments to the semantic tokens.
- Older `--color-*` names may remain temporarily as compatibility aliases while
  migrated components move to semantic roles. New UI work should prefer the
  semantic tokens directly.

## Base Palette

Use the Stitch palette as the canonical palette layer:

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

Components should consume tokens by intent rather than by color family.

- Surfaces:
  `--surface-canvas`, `--surface-panel`, `--surface-panel-alt`,
  `--surface-panel-strong`, `--surface-panel-elevated`,
  `--surface-overlay`, `--surface-overlay-strong`
- Text:
  `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse`,
  `--text-accent`, `--text-destructive`
- Borders and rules:
  `--border-default`, `--border-strong`, `--border-focus`,
  `--rule-subtle`, `--rule-strong`
- Actions and states:
  `--action-primary-bg`, `--action-primary-bg-hover`,
  `--action-primary-ink`, `--state-success`, `--state-warning`,
  `--state-danger`, `--state-live`, `--state-ready`, `--state-idle`
- Shape:
  `--radius-control`, `--radius-card`, `--radius-container`,
  `--radius-pill`
- Elevation:
  `--elevation-none`, `--elevation-subtle`, `--elevation-raised`,
  `--elevation-modal`

## Typography

- Display and body: Inter.
- Labels, metadata, timestamps, codes, BPM-like values, and technical readouts:
  Geist.
- `display-lg`: 48px / 56px, 700, `-0.02em`.
- `headline-lg`: 32px / 40px, 600, `-0.01em`.
- `headline-md`: 24px / 32px, 600.
- `body-lg`: 18px / 28px, 400.
- `body-md`: 16px / 24px, 400.
- `label-md`: 14px / 20px, 500, `0.02em`.
- `label-sm`: 12px / 16px, 500, `0.05em`.

Typography roles should be exposed as tokens or token-backed utilities:

- Body copy uses the default interface body role.
- Headings use the heading role with tighter tracking where needed.
- Technical labels and metadata use the mono-label role.
- Dense inspector readouts and timestamps should reuse the same technical/meta
  treatment instead of introducing one-off font stacks.

## Layout & Spacing

Use a fixed-fluid hybrid grid:

- Desktop: persistent 280px left OS rail, 12-column content grid, 24px margins,
  16px gutters.
- Tablet: 8-column grid, 16px margins, 16px gutters.
- Mobile: 4-column grid, 16px margins, 12px gutters, compact workflow nav.
- Inspector panels: 320px when present.
- Base spacing unit: 8px.

Large functional blocks, such as a service timeline, transfer panel, lyrics
editor, or media dropzone, should have at least 32px safe areas when the action
is likely to happen under pressure.

## Elevation & Depth

Depth is communicated through tonal layering and subtle outlines:

- Level 0: `#0b1326` / near-black canvas.
- Level 1: `#171f33` or `#18181B` style containers with a 1px outline.
- Level 2: `#222a3d` or `#2d3449` active/floating surfaces.

Shadows should be tight and low-opacity. Purple ambient shadow is allowed when
it helps an active control or panel separate from the background, but shared
elevation intents should come from the semantic elevation tokens rather than ad
hoc shadow strings.

## Shapes

- Small chips and badges: 4px.
- Standard buttons, inputs, and cards: 8px.
- Large containers, modals, and main panels: 12px.
- Status badges may use pill shapes when distinguishing Live, Draft, Ready, or
  alert states.

## Components

Prefer stable semantic utilities or equivalent token-backed patterns:

- Surface card
- Elevated panel
- Secondary text
- Primary action
- Secondary action
- Danger action
- Technical label
- Modal container

- Primary buttons: electric purple or primary-container fill with high-contrast
  text.
- Secondary buttons: transparent or dark ghost surface with a 1px slate border.
- Technical buttons: compact Geist labels for quick production actions.
- Inputs: darker than surrounding surfaces, etched appearance, purple focus.
- Service cards: left drag handle affordance where ordering/editing is present;
  active service item may use a 4px vertical primary stripe.
- Status indicators: saturated pips. Red for Live/critical, blue for Ready or
  technical state, gray for Idle.
- Inspector panel: right-aligned, compact, data-dense, tuned for song details,
  volunteer assignments, and production metadata.

## Screen Flow

The project should continue to map the Stitch screen set into the app:

- Service Flow Hub
- Worship Song Formatter - Landing
- Worship Song Formatter - Interactive Editor
- Worship Song Library
- Production Media Tools
- Live Sermon Captions & Translation
- Design System

Future process updates should adapt workflows to these screens while preserving
the worship-service-only domain and strict worship block order.

## Exports

`tokens.css` remains the canonical token source. Keep it aligned with this
Stitch design system, and keep `src/app/globals.css` aligned as the semantic/UI
contract layer that shared components consume.
