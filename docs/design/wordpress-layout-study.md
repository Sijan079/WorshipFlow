# How WordPress lays out a page (behaviour study)

Studied on 2026-10-30 with the REA tool, by capturing two live WordPress pages: the official Twenty Twenty-Five demo
(a block theme, so it shows what the block editor itself produces) and the free "Church WDA" church theme demo.
This records **behaviour only**. WordPress is GPL, so no WordPress code, CSS or images are copied into WorshipFlow.
Everything under "Verified" was read from the captured pages. Anything under "Not verified" is from general knowledge
and must be checked before we rely on it.

## Verified: why WordPress pages look designed

The look does not come from fancier content. It comes from **a layout system with three widths and blocks that hold
other blocks**.

1. **Three widths.** The theme sets a *content width* (645 px in Twenty Twenty-Five) for text, a *wide width*
   (1340 px) for wide blocks, and *full* (the whole screen) for bands and heroes. A block opts in with an alignment:
   none (content), wide, or full.
2. **Constrained layout.** A container in "constrained" mode centres each direct child at the content width. A child
   marked wide may grow to the wide width. A child marked full has no maximum at all.
3. **Full-width inside a padded page.** The page has side padding. A full-width child cancels that padding with a
   negative side margin of the same size, so it touches both screen edges while the text stays inset. A container nested
   inside another padded one resets its padding to zero, so padding is never doubled.
4. **Group = a container block.** It can hold other blocks, and has its own inner layout (constrained, flow, or a flex
   row), its own padding from a fixed spacing scale, and its own background. The usual band is: a full-width group (the
   background) holding a constrained group (the text column).
5. **Rows.** A flex row with "space between" puts items at opposite ends (the header: site name left, menu right).
6. **Columns.** A flex row of column blocks. At 782 px and wider the columns sit side by side and share the width
   equally, unless a column has its own width. Below 782 px they wrap into a single stack. Vertical alignment (top,
   centre, bottom) is a setting.
7. **Vertical rhythm.** One block gap (about 1.2 rem) between neighbours, and larger named spacing steps (30 to 70) for
   band padding and spacers. Nobody types pixel values; they pick a step.
8. **Header.** Full-width band, wide row: site name on one side, the menu on the other. On small screens the menu
   collapses into a button that opens a panel.
9. **Footer.** Full-width band, wide area, Columns for the name and tagline and for lists of links, a spacer, then a
   bottom row with the copyright line at one end and a credit at the other.
10. **Church theme (Church WDA).** A header with a **call-to-action button**; a **hero** made of a picture and a centred
    message on a coloured (gradient) background; then a **call-to-action band**; then the **latest posts**; then a
    footer. The hero text is centred in a column about 90 % wide.

## Not verified

- The **Cover** block (a picture with text on top) was not on either captured page. From general knowledge it is a
  container with a background picture, a dark overlay of adjustable strength, a minimum height, and content centred on
  top. Capture a page that uses it before we build ours.
- The slide-over mobile menu's exact behaviour, and the editor's own side-panel controls (the capture shows only what
  visitors get, not the editing screen).

## What this means for WorshipFlow

Our editor stacks blocks in one fixed narrow column, so every page looks alike. To get a WordPress feel we need the
same foundations, in this order:

1. **Widths per block:** content, wide, full (our own numbers, for example 720 and 1200 px).
2. **Section (group) block:** holds blocks, has a background (colour or picture) and a padding step. Limit nesting to
   two levels so the editor stays simple.
3. **Columns block:** two to four columns, stacked below the phone breakpoint.
4. **Cover (hero) block:** full-width picture, overlay, headline and button on top.
5. **Site header and footer** with a call-to-action button, plus colour and font presets.

These need nested blocks, which `docs/changes/20261030.md` item 9 left out on purpose; building them needs a decision
recorded there first.
