# Design

Status: contract, written 2026-10-26 (see `docs/changes/20261026.md`). It
records the approach hand-built into Services, Teams, the Song Formatter, and
Settings, and applies it to every new screen (People, Ministries, Events,
Announcements, Site management). The earlier Stitch project and the mockup sets
in `public/mockups/` are historical and are not the source of truth. The source
of truth is this file, `tokens.css`, and `src/app/globals.css`.

Old pages are brought in line only when a change touches them.

Each rule is tagged **Built** (the app already does it) or **Target** (decided,
not yet in the code). New screens follow both.

## Experience principles

The design starts from how the app should feel to a person, not from how it is
laid out. Many users are elderly and not tech-savvy; the rest are a busy tech
team. The reference for **feel** is the Song Formatter. The reference for
**structure** (tabular data) is Services.

1. **One job per screen, in a straight line.** The Formatter goes upload, then
   review, then export, with one primary button in the same place each time and
   a visible "Extracting…" while it works. A person always knows the next step.
2. **Use metaphors people already know.** The Formatter's result is a paper page
   with page numbers, zoom, undo and redo, like a word processor. Prefer a
   familiar object over a new interface.
3. **Explain in plain sentences, and be honest about uncertainty.** A warning
   says what was found, what the app did, and what to check ("It was kept so you
   can confirm whether it is a lyric"). It points to where, and it ranks what
   matters. Never show a confident result the app is unsure of.
4. **Nothing is easy to lose.** Autosave with a visible check, undo, recovery
   across devices, a list of recent work. Destructive actions say what will be
   removed.
5. **The page is the interface.** Edit the thing itself, in place, instead of
   filling a form about it.
6. **Show the next action in words.** Primary actions have visible labels.
   Icons support words; they do not replace them.

These come from the owner's direction (focus on UX for a person) and from what
the Formatter already does; the wording is the author's summary and can be
rewritten in the owner's own words.

## Two surfaces

- **App** (`/w/{workspaceSlug}`): used by the church's tech team. Light work
  surfaces, a dark navigation rail, purple as a signal. Everything below applies
  to it.
- **Public site** (`/c/{workspaceSlug}`): read by anyone, including many
  seniors. It has the church's identity, not the admin tool's. See "Public
  site".

Every screen must work on a phone.

## Approach (structure)

Hand-built, task-first screens. Start from what the user is trying to do and
from real data. Prefer an open ledger, hairline rules, and spacing over extra
containers. Avoid ornamental gradients and glow, filler metrics, badge spam,
repeated eyebrow labels, and equal card grids with no real hierarchy. Use
semantic tokens, never one-off colors, shadows, or radii.

**Never nest cards.** A surface (the page card, a dialog) does not contain another bordered,
filled, or rounded box. Inside a surface, give a section its own weight as a **panel**: a
full-width band that extends vertically, separated from its neighbours by a hairline rule
(`--rule-default`), with no border, radius, or shadow of its own. A panel may carry a subtle fill
(`--surface-panel-alt`) when it needs to stand apart, such as a preview area. Collapsible
sections take the same shape: a full-width row with a chevron, stacked, hairline between rows,
indented one step per level instead of boxed one inside another. Exempt: form fields, buttons,
an image that needs its own quiet zone (a QR code), and floating layers (popovers, menus,
tooltips) that sit above a surface. Built in Sermon Captions; Target in the older pages, which
are brought in line when a change touches them.

## Page contract

1. **Header** (Built; `ui-page-header`, `ui-page-title`, `ui-page-description`): the
   title and a one-line description on the left, the primary Add action on the
   right. The description exists to explain what a module is for. Settings is
   the exception: it has no page header, because its purpose is already known.
2. **One register** per page (Built; `ui-surface-elevated ui-operational-register`)
   holding a toolbar and an open ledger. Do not wrap a page-level list in
   another card, and do not make a card per row.
3. **Toolbar order** (Built): filters, then "Clear filters" (only while a filter is
   active), then the count, then refresh, then bulk-action icons (only once rows
   are selected). The Add action stays in the header, never the toolbar.
4. **Ledger** (Built; `ui-ledger-header`, `ui-ledger-row`): aligned columns, hairline
   rules, selection as a faint purple wash with no second border. Below 1200px
   secondary columns collapse into a muted line under the title.
5. **Rows**: a trailing row menu (`ui-row-menu-trigger`, 44px). The
   hover rule is Built: on screens that support hover
   (`(hover: hover) and (pointer: fine)`) it appears on row hover or keyboard
   focus; on phones and tablets it is always visible. Decide by hover support,
   not screen width. The three-dot icon is Target (Services and Teams show a
   hamburger icon today). Clicking a row either expands it inline or opens its
   edit dialog; pick one per module and keep it. Expanded rows stay connected to their row
   with one purple left rule.
6. **States**: loading is a row skeleton (Built) that does not flash on refetch
   (Target); empty states say what is missing and what to do (Built); list-load
   errors show a danger band with a Retry button (Built in Settings only, Target
   everywhere else). Every page needs all three.
7. **Settings sections** (Built): Add sits beside the section heading, Save appears only
   when the section has unsaved changes, rows show their own dirty or failed
   state, and editing is inline instead of in modals.
8. **Pages that are not lists** (Sermon Captions, the Song Formatter) are one surface, or none, divided
   into vertical panels, with the next action in the header.

## Controls

- Buttons: `ui-btn-primary` (purple, 44px), `ui-btn-secondary`, `ui-btn-cancel`
  (outline, red on hover) are Built. `ui-btn-danger-solid` (solid red with white text) is Built, for
  an action that ends something live, such as Stop captions. `ui-btn-danger` visibly red at rest is
  Target for Delete buttons; today they, and Services and Teams, turn red only on hover.
- Text fields in forms follow the Services text boxes (`.ui-text-field` in
  `globals.css`, used by the People and Ministries dialogs through
  `src/features/people/field-styles.ts`): a plain rounded 1px `--border-default`
  border on a transparent field, never sunken, and the border turns purple
  (`--border-focus`) when the field is selected, with no outline ring. The label sits
  above in sentence case, `text-sm`, regular weight, secondary color. Every input gets a
  global grey fill and inset shadow, which only a `globals.css` rule can switch off, so
  do not try to restyle a field with Tailwind utilities alone. Toolbar search keeps
  `ui-field`. Selects: `ProductionSelect`. Checkboxes: `ui-checkbox`.
- Open question: `ProductionSelect` and the date picker default to small uppercase
  mono labels (as in the Services create dialog), while text fields use plain
  sentence-case labels. One style per form is the goal; not yet decided.
- Dialogs: the shared Radix `Dialog`, one surface (Built), with `ui-modal-close` always present. A dialog
  that asks a question or holds unsaved changes has an explicit Cancel; one whose choices apply the moment
  they are made ends with Done. Actions are right-aligned.
- Feedback (Target): every mutation shows a success toast and an error toast.
  No silent failures. Today only Services and the Formatter use toasts.
- Icon-only secondary controls have no border and no fill: muted at rest, accent on hover, 44px, with an
  accessible label and a tooltip (see "Feel and reasoning").
- A confirmation of a serious action (stop, end, regenerate, delete) says what will happen, defaults to
  Cancel, and its positive button reads **Yes, I am sure**. Built in Sermon Captions; the older delete
  dialogs are brought in line in the design unification pass.
- Press-and-hold row selection may supplement the visible checkbox but is never
  the only way to select.
- Touch targets are at least 44px for primary controls and row triggers.

## Color

- Components use only semantic tokens (`--surface-*`, `--text-*`, `--border-*`,
  `--rule-*`, `--action-*`, `--state-*`, `--radius-*`, `--elevation-*`). Do not
  put raw colors in components or `globals.css`.
- Light workspace palette (see `tokens.css`): canvas and panels `#ffffff`,
  subtle fields `#f8fafc`, inactive controls `#f1f5f9`, text `#111827`
  `#475569` `#64748b`, rules `#e2e8f0` `#cbd5e1`, action and focus `#7c3aed`
  (hover `#8754ee`), danger `#b91c1c`, success `#047857`, warning `#b45309`.
- Purple is a signal: primary actions, focus rings, selection, the active tab, and one floating button
  that also marks something running live for you (the captions button, which pulses). It is never a
  status color and never a ledger background.
- **Trial (2026-10-27):** sky blue `#0369a1` is the secondary accent for accent text, links, and the
  hover and active states of secondary actions (5.9:1 on white; its light wash `#e0f2fe` marks a
  highlighted row). It is one token, `--workspace-text-accent`, with `--action-secondary-accent-*` and
  `--surface-highlight`; pointing them back at the purple tokens undoes the trial everywhere. The owner
  decides after living with it whether it becomes Built (rolled out in the design unification pass) or
  is dropped.
- Status is a small dot plus a colored label, not a filled badge. Red means an
  error, or an action that is destructive or disruptive to an operation (Stop, Delete); "Draft" uses a
  neutral color.
- The dark navigation rail uses `--rail-*` tokens and stays.

## Typography

- Inter for display and body. Geist Mono for technical text.
- Page title 30px/600. Section title 16px/600. Body and row text 14px.
- **No text under 12px** (Target: Settings and the rail use 10-11px labels today). Form labels and headings inside a page are sentence case. Dialog titles are in Title Case, with small
  words such as "a" and "or" in lower case (Audio Input, Invite a Member). A page title is the module's name.
- Uppercase mono labels are reserved for small codes and metadata (counts,
  timestamps, numbering), never headings or form labels.

## Accessibility and plain language

- WCAG 2.2 AA is required on both surfaces: text contrast of at least 4.5:1 at
  its size on every surface it sits on (muted text included), visible focus
  states, and no information carried by color alone. Check contrast; do not
  assume.
- Primary actions and toolbar actions have visible words. Icon-only controls are
  for secondary actions, with an accessible label and a tooltip.
- Use the words staff use: People, Ministries, Events, Announcements. Avoid
  jargon in the UI; "register" and "ledger" are design terms, not user terms.
- Reduced motion is respected globally.

## Navigation

(Target; the rail still uses group labels and shared icons.) The rail lists, in order: Dashboard, People, Ministries, Events, Announcements,
Page Builder, Worship (expandable: Services, Songs, Media Tools, Captions), and
Settings. No group labels: the list is short. Every item has its own distinct
icon (Services and Events must not share one). In-development items carry a
small "DEV" pill. The rail uses the dark `--rail-*` tokens.

## Layout

- Breakpoints: 1200px is the desktop switch (persistent rail, ledger columns,
  Settings tab rail); 600px divides phone from tablet. Do not introduce other
  switches.
- Content width up to 1540px. Page rhythm `space-y-6`. Ledger rows have a
  minimum height of `--ledger-row-min-height`.
- Phone and tablet use the side drawer for navigation. There are no bottom
  sheets; dialogs are centered.

## Motion

Motion explains state or spatial change, never decorates.

- CSS and Tailwind transitions first: `--dur-fast` 120ms, `--dur-base` 180ms,
  `--ease-out`. Panels up to 220ms. No bounce.
- Motion for React only for expand, reorder, and enter/leave.
- Animate `transform` and `opacity`. Button scale stays between 0.97 and 1.01.
- Two exceptions, on purpose: a panel that opens and closes animates its height, because panels have
  little room and cannot slide smoothly any other way; and a status that must be noticed may pulse (the
  Live dot), because the pulse carries meaning.
- **Things travel from where they were to where they are, and never jump.** A panel slides open, a list
  drops from its field, a moved item glides to its new place. Built for panels, dropdowns, and the
  confirmation slide. Target where an item still vanishes at once (the Regenerate button when its
  confirmation opens), to be done with Motion for React layout animation.
- Panels that open and close use `.ui-collapsible-content` (180ms, height and opacity, from Radix
  Collapsible). Dropdown lists use `.ui-select-content` (120ms fade and a 4px drop, from where they
  open).
- Never animate information users are urgently reading, and never delay saving
  or navigation.

## Public site

Target: nothing here is built yet.

- It looks like the church, not the admin tool. Default template is neutral,
  warm, and light, with large readable type. It does not inherit the app's
  purple production look.
- Each church picks one of about five color and font presets. Block layouts are
  fixed; there are no custom layouts or themes beyond the presets.
- Body text is at least 18px, tap targets at least 44px, contrast meets AA, and
  navigation is always visible.
- The template is designed when the Site module is built (Roadmap step 8), as
  working pages in the app, and this section is then expanded.

## Calendar, refresh icon, and person field

- The calendar is one component everywhere (`ProductionDatePicker`): month and year menus on top,
  previous and next arrows, a "Today" shortcut unless a field turns it off (birthdays do). Years
  run from ten years back to five ahead unless a field sets its own range. Its height follows the
  space the browser has and it scrolls when the screen is short, so it is never cut off.
- A refresh button that spins uses the clockwise icon (`RefreshCw`); the counter-clockwise icon
  spun clockwise looks like it runs backwards.
- A person field on a service is a raised box (`.ui-raised-field`, a soft shadow rather than an
  inset one): search icon and "Name" on the left, a dropdown arrow on the right, still searchable.
  It has no "Manage people" link.

## Feel and reasoning

What the owner settled while designing Sermon Captions, as a short list. The reasoning behind each
decision, where it is built, and its status (Built, Trial, Target) are in `docs/design/decisions.md`, a
log by topic. A page gets its own notes only when it has reasoning no other page shares. This section is
the author's summary of the owner's direction and can be rewritten in the owner's own words. Changing it
goes through a grilling session (see `AGENTS.md`).

### The feel

Calm and quiet, with one obvious next thing. The screen shows what you need to run it right now. What
you need once (setup, where the audio goes, the link) is one tap away, never in the way. Serious
actions are slow on purpose and everything else is fast. Words are plain, because the person at the
booth may be tired or new, and the people reading may be older. Nothing is specific to one church or
one piece of equipment, because this is a multi-church product.

### Decisions

1. **One screen, no tabs.** Setup lives in a dialog opened by an options icon, and Start with no input
   chosen opens it instead of being a dead button.
2. **The next action sits at the top right.** Start and Stop go in the page header, never inside a card.
   Start is the one purple button; Stop is solid red (`ui-btn-danger-solid`).
3. **Quiet controls.** A secondary action that needs no words is an icon with no border and no fill,
   with a label and a tooltip. If it needs words, the word sits beside the icon (Test).
4. **A status is a signal.** A dot and a label in the same colour; Live pulses; red means an error or
   something destructive or disruptive.
5. **Information on request.** Facts needed now and then sit behind an information icon; the link is
   copied, not printed. A disclosure is moved one tap away, never deleted.
6. **Help is closed by default.** Setup and Troubleshooting open on their own, in plain steps, and name
   no mixer and no church.
7. **Never nest cards.** A surface holds panels that extend vertically, and its content fills it.
8. **A deliberate action needs an aware yes.** Stop and Regenerate ask first, say what will happen,
   default to Cancel, and the positive button reads **Yes, I am sure**. A blocked action explains itself
   with a toast.
9. **Things open and close smoothly.** Things travel from where they were to where they are, and never
   jump.
10. **Unity.** An element that does the same job looks and behaves the same everywhere in the app. Polish
    comes from that consistency.
11. **One link, one control.** The congregation gets one stable link and QR code; Start and Stop only
    decide whether captions are live.
12. **Words are plain and honest.** Messages say what was found and what to do.
13. **One floating live button.** While captions run behind other pages, a purple pulsing microphone sits
    at the bottom right; it opens a small panel to go back or stop. It is the only floating button in
    the app.

### Older pages

The rules apply at once to anything a change touches. Roadmap step 10, the **Design unification pass**,
brings the older pages in line one page at a time with the checklist below.

### Checking a new screen

Ask of any new screen:

- Is there one screen for the job, with the next action at the top right?
- Is exactly one thing a filled button, and are the rest quiet?
- Can the state be read from colour and a dot alone?
- Is anything shown that is only needed once? Move it behind an information icon or a closed help panel.
- Is there a card inside a card? Turn it into a panel.
- Does a serious action ask first, say what will happen, and default to Cancel?
- Does every opening, closing, and move animate, and does reduced motion still work?
- Does an element that does the same job look and behave the same as it does elsewhere in the app?
- Is every word plain, and free of one church's or one device's name?

### Open questions

- The secondary accent trial (sky blue `#0369a1`): keep it and roll it out app-wide in the unification
  pass, or drop it? The owner decides after living with it.

## Automated checks

`npm test` fails when any `.tsx` file adds a text size under 12px
(`text-[10px]`, `text-[0.7rem]`) or a raw hex color. Existing violations are
listed in `src/lib/design-rules-baseline.json` and only print a warning, so old
pages are fixed when touched. Fixing legacy violations lowers the count; run
`npm run design:baseline` afterward to record it. Never regenerate the baseline
to allow a new violation. The rules live in `src/lib/design-rules.ts`.

## Tokens and exports

`tokens.css` is the canonical token source and `src/app/globals.css` is the
semantic application layer. Keep them aligned with this file. Some older
`--color-*` names remain as migration aliases; prefer semantic tokens in new
work.
