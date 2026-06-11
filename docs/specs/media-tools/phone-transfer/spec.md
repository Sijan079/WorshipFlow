# Phone Transfer Spec

## Purpose

Phone Transfer receives screenshots or photos from a mobile device into a
temporary server-backed room that the desktop production workspace can access.

## Scope

- Desktop secure room link and QR code.
- Mobile sender route.
- Token-gated server upload API.
- Temporary private server inbox.
- Optional batch notes.
- Preview, download, batch download, and delete actions.
- No permanent service-asset attachment or archive behavior.

## Current Behavior

- Received files are stored in private server storage and listed through
  token-gated API routes for a limited time.
- The room token is long, unguessable, and stored server-side only as a hash.
- Phone uploads require the room to be active and unrevoked.
- Uploads are limited to image file types with per-file and per-batch size caps.
- Long-term storage is handled by the church desktop or existing production
  folder structure after download.

## Production Notes

Vercel hosts the web app. Production deployments need durable private file
storage for the temporary room files. Rooms and files remain temporary and
should be expired by retention cleanup.
