# Design Notes

The canonical design source remains the root-level `DESIGN.md` and
`tokens.css`.

Token responsibilities are split intentionally:

- `tokens.css` is the editable source for the base palette and semantic design
  primitives.
- `src/app/globals.css` is the semantic mapping layer that exposes shared UI
  utilities and global affordances.

Use this folder for supporting design notes, audits, screen studies, and
versioned design decisions that should not replace the root design contract.
