# Lyrics Editor Behavior Reference

Source video: `docs/videos/Recording 2026-06-15 120111.mp4`

Duration: 23.83 seconds

## Observed Behavior

The recording shows the song formatter section editor while text is being edited inside a section. The lyric area appears visually merged into the section card: the field is transparent, the text sits directly on the card surface, and the focus treatment reads like the whole section body is the editor rather than a normal textarea.

During editing, the cursor is visible around empty lines near the end of a section, with the next section card immediately below. This makes line deletion and Backspace behavior hard to reason about because the field boundary is not visually distinct from the section container.

## Desired Behavior

Each song section should keep its own lyrics field inside the draggable section card. That field should look and behave like a standard textarea:

- Native browser text editing behavior for typing, selection, line breaks, and Backspace.
- A visible textarea boundary separate from the card body.
- Normal text sizing and padding.
- No chorus-specific italic or accent text styling inside the editable field.
- Dragging should remain tied to the drag handle, not the textarea.

## Implementation Reference

Use this video as the reference when evaluating future changes to the song formatter lyrics editor. The section card structure can remain, but the lyrics entry surface should not be treated or styled as an inline editor.
