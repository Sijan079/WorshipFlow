# Song Formatter Spec

## Purpose

Song Formatter turns uploaded or pasted worship lyrics into structured,
church-ready output.

## Scope

- Upload lyrics or chord sheets.
- Paste lyrics directly.
- Extract and normalize lyrics.
- Edit structured sections.
- Generate DOCX output.
- Preserve generated output records where applicable.

## Constraints

- Formatter workflows support worship preparation only.
- Temporary extraction inputs should stay safe and scoped.
- Shared parsing logic should remain portable for future desktop use.

## Document editor

The formatter uses a continuous editable document displayed on portrait US
Letter pages with one-inch margins and Arial 11. Pages are a visual projection
of ordered song sections; they never become parser data or manual page breaks.
Pagination approximates the DOCX. Word may wrap and paginate it differently.
Export remains DOCX for FreeShow; PDF download and rich text formatting are
outside this release.

- Bracketed section tags are protected headings. Change the current section's
  tag through the toolbar; a selection is expanded to whole lyric lines and
  becomes tagged sections. When it crosses existing sections, their boundaries
  remain separate and each selected portion receives the tag.
- Enter and Shift+Enter insert lyric lines. Backspace at a section boundary
  does not merge sections. Section actions explicitly split at the current
  line boundary, merge with the preceding section (keeping its tag), insert, duplicate,
  move, or delete. These actions and text editing support undo/redo.
  Insert and Duplicate ensure a real blank lyric line between the old and new
  section, preserving existing extra blanks. Duplicates also remain separated
  from a following section. Other section actions do not normalize spacing.
- Two-/three-line grouping applies to all sections with the current tag. It
  retains lyric order and creates FreeShow-compatible repeated tagged groups.
  Fitting groups stay on a page together; longer sections continue across pages.
- A collapsible outline navigates sections and offers move controls. A custom
  right-click menu is opt-in under More editor options. Every action also has a
  visible keyboard-accessible control. Native text selection, copy/paste, and
  spellcheck remain available; pasted rich text is converted to plain lyrics.
  The outline list scrolls independently above pinned move-up/down controls.
  With the outline open, the active section has a subtle purple fill and side
  rule in the document, including when the section spans pages. The active
  outline row stays visible. There is no whole-document purple focus border.
- The header edits the export filename, not the lyrics of the Title section.
  The filename is plain text until its pencil button is clicked. Editing uses
  an underline, not an enclosed field; Enter, the check button, or blur commits
  the name, while Escape cancels. A custom check sits beside the pencil and
  turns green only when the current draft is acknowledged by the server. Pending
  changes and storage failures use distinct neutral/warning icons with
  accessible status text and tooltips; unsaved name edits are never green.
  Downloads preserve spaces, Unicode and intentionally typed hyphens/suffixes;
  `Way Maker` downloads as `Way Maker.docx`, without an automatic `-lyrics`.
  Unsafe filename characters are replaced, reserved names protected, and an
  existing `.docx` extension is not doubled. Blank names use `Untitled song`.
  More editor options also contains AI reformat, workspace tag settings, and
  Clear draft. Warnings appear above the document and can be dismissed.
  The menu uses pale-purple/dark-text highlights, with red/white for Clear
  draft. Clearing opens a confirmation dialog focused on Cancel; confirmation
  deletes the temporary draft across devices, then returns to the upload/select-song
  screen. Clear is disabled while AI reformat or export is pending.
- The controls occupy a separate top card. The unframed gray document canvas
  scrolls independently. The save-status icon appears beside the filename; page count
  and zoom live in the toolbar. Document information contains the Letter/Arial
  details and approximate-pagination notice. There is no footer card.
  The controls reuse Services/Teams register surfaces, spacing and grouped
  actions. The viewer fills the remaining window height with a 24px bottom
  gutter rather than a fixed height offset or desktop height cap.
  Cursor scrolling is deferred until pagination has positioned new paragraphs,
  so Enter, paste and structural commands do not jump to the document top.
  Labeled Sections and Groupings ribbon groups divide the toolbar. Insert,
  split, merge, duplicate, move up/down and delete each have a directly visible
  icon with an accessible label and tooltip. The information control uses a
  matching vector icon, not a font-dependent character.
- Zoom presets are 50%, 75%, 100% and 125%. At 75% or below, two editable pages
  appear side by side if both fit after viewport padding and the outline.
  Otherwise the viewer keeps one column at the selected zoom. Pages flow 1/2,
  then 3/4; an odd last page sits on the left. One-page documents and phones
  stay single-column. Zoom changes never alter lyrics, undo history or exports.
- Phones use continuous editing without page gaps. Page preview is read-only
  and offers zoom; Edit lyrics returns to continuous editing.

## Context actions and shortcuts

Song actions on right-click are enabled by default; the options menu can turn
them off for the current editor session. Tag section opens a nested menu.
Every action has an icon and a right-aligned keyboard sequence. Anywhere on the
formatter page, including blank viewer space, Ctrl+K (Cmd+K on Mac) toggles a
persistent shortcut mode: I inserts, S splits, M merges, D duplicates, C copies
the active section, V pastes it after the active section, Up/Down moves the
caret, Alt+Up/Down moves the active section, X deletes, and T opens a compact
tag popover. Native Shift+Up/Down text selection and Ctrl/Cmd+C/V remain
unchanged. The existing Ctrl/Cmd+Alt+Up/Down section movement remains available.
A floating legend stays pinned above the document viewer
without changing its height. Ctrl/Cmd+K, Escape, or its close button exits the
mode.

Shortcut mode restores the user's last caret or text range and scrolls it into
view. Before any user selection, it places the caret at the end of the bottom-most
non-empty lyric line. After the floating overlay and pagination settle, an
offscreen activation target scrolls smoothly to the upper third below the
overlay; an already visible target stays put, and reduced-motion mode scrolls
immediately. Subsequent caret and section movement scrolls only enough to remain
visible. The target line receives a purple cue and updates immediately when
another line is selected. Remembered selections map through edits and fall back
to the last meaningful line when they cannot be restored. Applying a tag keeps
shortcut mode active; Escape closes the tag popover before a second Escape exits
shortcut mode.

Alt+Up/Down works only while shortcut mode is active and the lyrics editor owns
focus. One key press moves one section; key repeat is ignored. The caret keeps
its lyric and character offset inside the moved section. A selection spanning
sections moves the section containing its head and collapses at the preserved
head. Boundary moves are no-ops.

Split section operates on whole lyric lines. On the first line of a multi-line
section it splits after that line; on later lines it splits before the caret
line. Single-line sections cannot be split. Both resulting sections retain the
tag, and the upper section receives a trailing blank lyric only when one is
needed to separate the tags for FreeShow.

Copy section preserves its tag and lyric lines in an editor-local structural
buffer and also writes plain text to the system clipboard when allowed. Paste
uses that structural buffer first, otherwise accepting one tagged or untagged
section from clipboard text. It creates a fresh section identity, preserves
intentional blanks, and guarantees at least one blank-line separator on both
adjacent boundaries. Copy does not change history; each paste is one undoable
change. Clipboard feedback floats in the viewer overlay without moving the
document. Loading another conversion resets shortcut mode and its local buffer.

## Temporary cross-device recovery

One current draft is stored per signed-in user/workspace. It includes lyrics,
filename, warnings and the used-AI flag, but not uploaded files or AI retry tokens.
The upload page lists it in Recent Conversions instead of a separate banner.
The latest successful conversion has a Draft label and an edit icon for Resume;
Done rows use a purple check. Rows identify the last editor by display name and
relative last-touch time without exposing email, expiry or legacy-recovery copy.
Recent Conversions uses row skeletons during its initial load. Failures do not replace
the active draft or push it out of the five-row history list. A conversion
becomes current only after extraction and draft persistence both succeed.

Leaving or closing the editor starts one hour. Resuming cancels that countdown;
export leaves the draft editable. Backgrounding the tab does not deliberately
release it. Heartbeats run every 30 seconds; five minutes without contact starts
the fallback hour, including when a browser suspends the tab. An unclaimed new
conversion expires after one hour if the editor is never opened.

A second device previews read-only and must explicitly Take over editing. Old
session IDs and stale revisions cannot save. Done conversions retain only name,
source, parser, dates and status: no preview, download, or reopening. Expiry,
replacement and confirmed clearing delete the draft payload. Existing generated
outputs elsewhere in the service workflow are not affected.

Browser storage holds only bounded unsynced fallback content, linked to the
server conversion/revision and deadline. It cannot revive a Done conversion.
Offline devices purge invalid copies when next checked. A legacy browser draft
can be explicitly recovered only when no new-format conversion history exists.
The saved check is green only for a server acknowledgement; failed sync is
reported, and existing local edits can still be exported while offline.

Scheduled cleanup runs every five minutes, with opportunistic expiry checks on
access. Production must configure the scheduler described in the deployment
guide. See [ADR 0004](../../adr/0004-temporary-formatter-drafts.md).

## Verification and future work

Run `npm run test:song-editor` for document, history, recovery, pagination, and
integration checks. `npm run verify:song-editor` serves an isolated browser
fixture at `http://127.0.0.1:4318` using the real editor and DOCX generator with
test identity responses. It does not bypass authentication in the application.
The browser assertions are in `scripts/fixtures/assert-song-editor.js`.

Directly editable tag text is a recorded future option. Named workspace drafts,
manual page breaks, PDF export, exact Word rendering, and individual text
formatting are deferred.

Architecture: [ADR 0003](../../adr/0003-song-document-editor.md).
