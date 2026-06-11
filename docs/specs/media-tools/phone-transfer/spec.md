# Phone Transfer Spec

## Purpose

Phone Transfer receives screenshots or photos from any signed-in device into a
global temporary inbox for the site. The same inbox is visible from phone,
desktop, or another trusted device after passing the normal site access gate.

## Scope

- Global protected upload route.
- Global protected inbox route.
- Temporary private server inbox.
- Optional batch notes.
- Preview, download, batch download, and delete actions.
- No permanent service-asset attachment or archive behavior.

## Current Behavior

- Received files are stored in private server storage and listed through
  protected API routes for a limited time.
- Uploads use the normal app access gate instead of QR pairing, room links, or
  per-room tokens.
- Any signed-in device can upload, preview, download, or delete inbox items.
- Uploads are limited to image file types with per-file and per-batch size caps.
- Long-term storage is handled by the church desktop or existing production
  folder structure after download.

## Production Notes

Vercel hosts the web app. Production deployments should configure Supabase
Storage through the private output storage adapter because Vercel local
filesystem writes are not durable across requests. Files remain temporary and
should be expired by retention cleanup.
