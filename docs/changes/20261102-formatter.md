# 2026-11-02: Song Formatter, presenter-ready export (FreeShow first)

Agreed with the owner on 2026-11-02. Each item gives the document, the version before (From), and the version after (To).
This file is named `20261102-formatter.md` because the Page Builder work on another branch also has a `20261102.md`.

## Scope

1. `docs/core/Product.md`, Formatter line
   - From: "Song formatter, resize image, background removal: kept, no new investment now."
   - To: the Song Formatter gets new investment for one thing: making any song ready for a presenter app. FreeShow
     comes first. ProPresenter waits until the owner has tested one export from it and shared the result, because its
     text import is only partly confirmed. Resize image and background removal stay as they were.

## Decisions (all confirmed by the owner)

2. FreeShow first. ProPresenter later, after a real sample.
3. A part is written once with its name, and its slides are separated by a blank line. Every repeat is written out in
   the order it is sung (FreeShow merges identical repeated slides by itself).
4. Lines per slide: 2 by default, up to 4, or "As written". Splits are even, so a slide is never left with one line, and no
   slide is more than one line over the limit.
5. Parts with no words (Instrumental, Interlude, Intro without lyrics) are kept as an empty slide, because removing
   them is not safe: a part might hold words.

## What was built

- `src/features/song-formatter/presenter.ts`: part names (V1 becomes Verse 1, Ch becomes Chorus), even slide splitting,
  and the FreeShow text. Pure functions with tests in `presenter.test.ts`.
- The FreeShow text starts with a `Title=` block. FreeShow (read from its importer source) treats any line with `=` as a
  note and removes it from the lyrics, treats "Word: text" lines in the first block as notes, and reads a `[...]` line as a
  part header and `---` as the start of slide notes. A lyric line with `=` is changed to a full-width `＝`, a `[...]` lyric line
  to `(...)`, and `---` to a dash, and each such line is listed to the person. A colon in a title is written as " - ".
- "Group" no longer repeats the tag. It makes one part with a blank line between slides (it used to write [Verse] three times,
  which FreeShow reads as three verses).
- The Export button opens a dialog: lines per slide, a preview of exactly what FreeShow will read, warnings, Download,
  Copy, and a smaller "Download Word document". The "Supported output" list now names only what exists (it used to
  list Planning Center XML, ProPresenter 7 Slides, PDF chords and Markdown, none of which were built).
- The formatter tests now run under `npm test` as well as `npm run test:song-editor`.

## Not done, on purpose

- ProPresenter: only second-hand facts so far (text and Word import, "Paragraph Break" splits slides, label-only lines become
  groups). Official pages were behind a login. Next step is a sample exported from the owner's ProPresenter.
- Native `.pro` and FreeShow `.show` files; wrapping long lines; expanding "x2" and "repeat chorus"; removing chord lines
  (the extractor already warns about those).
