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

Each tool has its own spec folder under `docs/specs/media-tools/`.

## Navigation

The Media Tools sidebar item owns a subgroup for individual tool URLs:

- `/assets`
- `/assets/phone-transfer`
- `/assets/qr-generator`
- `/assets/background-generator`

The `/assets` route acts as the tool selector page.

## Deprecated

Persistent service asset uploads are intentionally deprecated. PAP should bridge
phone captures into the booth; users then download or move files into the
church's existing desktop storage.

Media conversion is disabled in the web app. The project should not ship a web
converter that could imply downloading, extracting, or transforming media from
third-party services in ways that may conflict with their terms. Any future
conversion work should be local-first, rights-aware, and explicitly scoped to
files the church is allowed to process.

Background Generator currently uses a three-stage image-only workflow:

- Data Entry
- Estimation
- Output

Generated backgrounds are treated as temporary workspace assets, not permanent
library items. The active workflow includes estimate confirmation, output
preview, download, recent-image preview, and 24-hour automatic cleanup.
