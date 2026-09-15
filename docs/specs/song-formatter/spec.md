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

## Future UI Rework Note

Explore replacing the current section-card editor with a paginated document
canvas that feels familiar to users of Microsoft Word or a browser PDF viewer.
This is a design direction for later validation, not an approved implementation
contract.

Candidate direction:

- Present the formatted song as printable DOCX/PDF-style pages while keeping
  structured song sections and tags as the underlying source of truth.
- Move the current side-menu controls into a compact editor header or toolbar,
  including file/title details, section tagging, line grouping, undo/redo, and
  export actions. Use responsive overflow rather than crowding the header.
- Add a custom context menu for quick actions such as tagging selected lyrics,
  changing a section tag, splitting or merging blocks, and inserting a section.
- Keep visible buttons and keyboard-accessible commands for every context-menu
  action. Do not remove native copy, paste, text selection, spellcheck, or other
  expected editing behavior.
- Preserve clear warning, saving, dirty, selected, and export-preview states
  without covering the document content.
- Treat the document view as an editing projection of structured formatter data,
  not as a replacement for the parser or a second song-storage format.

Before implementation, validate DOCX-versus-PDF pagination expectations,
selection and caret behavior across page boundaries, mobile fallback behavior,
accessibility, and how closely the preview must match the exported document.
