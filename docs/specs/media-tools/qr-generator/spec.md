# QR Generator Spec

## Purpose

QR Generator creates scannable QR codes for worship-production links or text.

## Scope

- Destination URL or text input.
- Service resource, giving, connect card, livestream, sermon notes, and custom
  title presets, plus editable title and subtitle.
- Slide, print, and social output sizes.
- QR-only or composed card export from the browser.

## Notes

The browser generates QR data with the `qrcode` package and composes downloadable
assets locally. Presets are convenience copy, not separate product workflows.
