# QR Generator Design

## Purpose

QR Generator is a temporary church QR asset maker inside Media Tools. It helps
the production team turn an existing link or text value into a polished QR asset
for slides, print, and social/chat posts.

The tool is not a saved campaign manager, analytics product, event-management
feature, or long-term content database.

## Primary Use Cases

- Fellowship pre-registration links.
- Giving links.
- Connect card links.
- Prayer request forms.
- Livestream links.
- Sermon notes links.
- Custom URL or text payloads.

## Product Shape

The generator uses church-oriented presets on top of a flexible QR encoder.

Presets:

- Fellowship Pre-Reg
- Giving
- Connect Card
- Prayer Request
- Livestream
- Sermon Notes
- Custom

Each preset provides default title, subtitle, and suggested filename values.
Users can edit all visible text. Presets should speed up common church workflows
without locking the generated QR to a specific ministry or service.

## Scope

In scope:

- Client-side QR generation.
- Destination URL or text input.
- Gentle warning when input does not look like a URL.
- QR-only preview and export.
- Labeled-card preview and export.
- Custom title and subtitle for labeled cards.
- Foreground and background color controls.
- Output size presets for slide, print, and social use.
- Download PNG.
- Download SVG for QR-only output.
- Copy rendered PNG image when supported by the browser.
- Copy source URL/text.

Out of scope:

- Saving QR history.
- Database-backed QR records.
- Scan tracking or analytics.
- User ownership or sharing permissions.
- Logo upload or branding.
- Third-party URL shortening.
- Event or fellowship registration management.

## Screen Layout

The page remains at `/media-tools/qr-generator`.

Desktop layout:

- Two-column production panel.
- Left column: controls.
- Right column: live preview and export actions.

Mobile layout:

- Controls stack above preview.
- Export actions stay directly below preview.

The existing Media Tools page title and description remain the page-level
context. The QR Generator section should feel like a focused booth utility, not
a landing page.

## Controls

Preset selector:

- Selecting a preset applies that preset's default title, subtitle, and filename
  when the user has not already edited those fields.
- Selecting Custom leaves fields blank or preserves current manual values.

Destination input:

- Accepts any text.
- Exports are disabled while empty.
- URL-like values pass silently.
- Non-URL values show a warning but can still be encoded.
- Very long values show a density warning because they may produce harder-to-scan
  QR codes.

Export mode:

- QR Only
- Labeled Card

Labeled card fields:

- Title
- Subtitle

Style controls:

- Foreground color.
- Background color.
- Sensible default error correction.

Size presets:

- Slide
- Print
- Social

## Preview

Preview updates as the user edits destination, preset, text, colors, or export
mode.

QR-only preview shows only the generated QR code.

Labeled-card preview shows:

- Title.
- Subtitle.
- QR code.
- Clean neutral card frame.

Exports use the current preview mode.

## Export Behavior

QR-only mode:

- Download PNG.
- Download SVG.
- Copy PNG image.
- Copy source URL/text.

Labeled-card mode:

- Download PNG.
- Copy PNG image.
- Copy source URL/text.

SVG for labeled cards is deferred because card SVG export adds extra complexity
and is not required for the first useful version.

If image clipboard APIs are unavailable, the app shows a clear fallback message
and keeps download actions available.

## Data Flow

All generation is client-side.

Data flow:

1. User chooses preset.
2. User enters URL or text.
3. Client generates QR using the existing `qrcode` package.
4. Preview renders the selected output mode.
5. Export actions generate PNG/SVG/copy output from current state.

No database writes, storage writes, or server-generated artifacts are required.

## Error Handling

- Empty destination disables export buttons.
- QR generation errors show inline feedback near the preview.
- Clipboard failures show a toast and suggest downloading instead.
- Non-URL input shows a warning, not a blocking error.
- Long input shows a scan-quality warning, not a blocking error.

## Testing

Manual checks:

- Generate a Fellowship Pre-Reg QR from an `https://` link.
- Generate a QR from plain text and confirm the warning appears.
- Toggle QR-only and labeled-card modes.
- Edit title and subtitle.
- Change foreground and background colors.
- Download QR-only PNG.
- Download QR-only SVG.
- Download labeled-card PNG.
- Copy source text.
- Test image copy in a supported browser.
- Check mobile layout.

Automated checks should cover pure helper logic where practical:

- URL-like detection.
- Preset defaults.
- Filename sanitization.
- Size preset mapping.

## Implementation Notes

The current QR Generator UI is a static mock in `ServiceBuilderClient`. The
implementation should replace that mock with a focused client component or
small local module while keeping the route at `/media-tools/qr-generator`.

No implementation should be committed or pushed until the local feature has
been tested.
