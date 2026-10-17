# Comment Card Spec

## Purpose

Comment Card converts comment text supplied by a worship-production operator
into a sharp, projection-ready PNG. It avoids enlarging a screenshot when the
original post content is already available as text.

The tool uses a familiar social-comment composition without Facebook logos,
trademarks, or claims that the result is an authentic platform screenshot.

## Inputs and Output

- Sender name
- Comment text
- Output-size preset
- Download filename
- Fit mode: contain, fill, or stretch
- Comment font size
- Line spacing in pixels (0–200), beside font size
- Optional sender visibility
- Automatic continuation cards when text exceeds the usable boundary

The template does not include a profile photo or avatar. Sender and comment
text support native emoji glyphs when the operating system provides a color
emoji font. The export is rendered locally in the browser at the preset's exact pixel
dimensions. The app keeps one browser-local draft per signed-in user and
workspace, including the sender, comment, filename, size preset, fit mode, font
size, line spacing, and sender visibility. Older drafts recover the spacing
implied by their saved font size. Comment content is not uploaded or synced across
devices. The status icon beside Rename shows when the current draft is saved on
this device, still saving, or could not be saved; an unapplied filename edit is
never shown as saved.

Workspace administrators can save multiple **Comment Card Name Template**
filenames under Settings → Templates. Exactly one saved name is active when the
list is nonempty. The first name added becomes active; activating another
replaces it, and deleting the active name activates the oldest remaining name.
The active name is loaded each time the Comment Card module opens, including
when a browser draft already exists. Saved sender, comment, and layout settings
remain available. A manual filename edit remains for the current visit, then
the active template name loads on the next visit. If no template exists, the
saved filename remains; a new card starts as `comment-card`.

Contain preserves the complete 16:9 composition, fill covers the output and
may crop its outer edges, and stretch maps the full composition to the output
dimensions. The white comment card uses a deep neutral shadow so it remains
distinct on a white background without adding decorative branding. Its frame
spans the available output height in every fit mode; fit controls the inner
16:9 text composition. The toolbar presents these fit modes as three icon
buttons with one active selection, alongside the font size, sender toggle, and
output size controls, without Content or Output dividers. The compact numeric
fields show **Font size** and **Line gap** labels, and the controls card uses a
subtle all-sided elevation shadow to separate it from the workspace canvas.

Running `npm run test:comment-card` without arguments opens a standalone local
playground and does not require the Next.js development server. The playground
stores sender, comment, dimensions, fit, preset, and filename in browser local
storage so the last working state returns the next time it opens. CLI arguments
remain supported for direct scripted PNG generation.

Pagination preserves the selected font size, line height, and padding. The
sender appears only on the first card; continuation cards use that released
space for comment text. Multi-card exports use `-part-1`, `-part-2`, and later
suffixes without truncating overflowing text.
The editable card and page previews scale text and usable width from the same
base geometry as the PNG renderer, so a line does not wrap early in the preview
solely because the browser window is wider.

On browsers that support the File System Access API, currently primarily
Chromium browsers such as Chrome and Edge, the playground can save directly to
an operator-selected folder after explicit permission. The selected directory
handle is retained locally. Other browsers fall back to their normal Downloads
folder because websites cannot silently choose arbitrary filesystem locations.

Supported presets include 1920x1080 presentation, phone portrait, portrait,
square, and 4800x2400 wide output.

## Workflow

1. Enter the sender and comment, or copy both together from a Facebook comment
   and use the Paste FB Comment icon beside **Download PNG**. The icon is
   outlined purple on hover, fills purple while the paste runs, and returns to
   its default state afterward. The paste action reads
   plain text from the browser clipboard, accepts a first-line name followed
   by comment text or `Name: comment`, and removes common copied timestamp and
   Like/Reply lines. It reports an error without changing the card when the
   name and comment cannot be separated. The sender is shown after a
   successful paste.
2. Select the destination dimensions.
3. Review the live preview.
4. Download the rendered PNG from the header. The card has no footer actions or
   character counter.

The icon-only **Clear** button beside Paste FB uses the same default, hover,
pressed, and focus styles. Its tooltip identifies the action. It empties the sender and comment.
It keeps the filename, output size, and formatting options so the next comment
can use the same setup. The empty card is saved to the local draft.

The main viewer and Export pages sit directly on the workspace background,
separated by one thin rule. Their gray canvas fill is removed. Exported PNGs
have transparent pixels outside the white comment card and its shadow.
The sender and comment editor fields blend into the white card without inset
field shadows, tinted fills, or full focus outlines. Keyboard focus uses a thin
purple line at the bottom of the active field.

Comment Card is additive. The existing Resize Image and AI/local upscaling
workflows remain available for source images that cannot be reconstructed from
text.
