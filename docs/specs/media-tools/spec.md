# Media Tools Spec

## Purpose

Media Tools collects focused utilities for worship production media.

Media Tools is a temporary preparation and handoff workspace, not a permanent
asset archive. Long-term media storage remains on the church production desktop
or existing local folder structure.

## Tool Areas

- Phone Transfer
- QR Generator
- Background Generator
- Resize Image

Each tool has its own spec folder under `docs/specs/media-tools/`.

## Navigation

The Media Tools sidebar item owns a subgroup for individual tool URLs:

- `/media-tools`
- `/media-tools/phone-transfer`
- `/media-tools/qr-generator`
- `/media-tools/background-generator`
- `/media-tools/resize-image`

The `/media-tools` route acts as the tool selector page.

## Deprecated

Persistent service asset uploads are intentionally deprecated. PAP should bridge
phone captures into the booth; users then download or move files into the
church's existing desktop storage.

Generic media conversion remains disabled in the web app. The local-only
[Resize Image](./resize-image/spec.md) tool is intentionally narrower: it
processes only an image the operator selects from their device and never
downloads or extracts third-party media.

Background Generator currently uses a three-stage image-only workflow:

- Data Entry
- Estimation
- Output

Generated backgrounds are treated as temporary workspace assets, not permanent
library items. The active workflow includes estimate confirmation, output
preview, download, recent-image preview, and 24-hour automatic cleanup.
