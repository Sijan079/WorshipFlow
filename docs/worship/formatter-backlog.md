# Song Formatter backlog

Kept apart from the CMS roadmap (`docs/core/Roadmap.md`). Found 2026-10-26 by
running "Process Locally" on `Our God [chords].docx`, which holds a chords
arrangement and a lyrics-only arrangement. The formatter kept the chords
arrangement and left the other out, as its warning says.

## Detection problems

1. **Misspelled direction kept as a lyric.** The source line
   "Intrerlude: G#m - E - B - F#/Bb (X2)" lost its chords and survived as
   "Intrerlude: (X2)" inside a Chorus. The correctly spelled "Interlude" line was
   dropped properly. Direction detection needs misspelling tolerance, and
   leftover repeat marks like "(X2)" should not survive on their own.
2. **Chord fragment kept as a lyric.** The Bridge Outro ends with
   "E - B - F# E(Fade))". It stays in the Bridge. The warning says a chord line
   was kept but does not say where.
3. **"Bridge Outro" is read as a Bridge**, so the Outro is lost.
4. **Confidence is "low" in the CLI** while the editor shows a calm review panel.

## UX notes

- Four warnings share one tall block with equal weight and no jump to the line
  they refer to. Rank them and link each to its location.
- The ribbon is mostly unlabeled icons (scissors, copy, move up and down).
  Visible words fit the new design rules.
- Phone layout was not reviewed (screenshots timed out on a slow hosted
  database).
