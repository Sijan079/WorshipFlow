# Phone Transfer Spec

## Purpose

Phone Transfer receives screenshots or photos from a mobile device into the
desktop production workspace as a temporary bridge.

## Scope

- Desktop pairing code and QR code.
- Mobile sender route.
- Supabase Realtime Broadcast signaling for pairing in deployment.
- Local WebSocket signaling fallback for LAN development.
- WebRTC data-channel transfer.
- Temporary local inbox.
- Rename, preview, download, batch download, and delete actions.
- No permanent service-asset attachment or archive behavior.

## Current Behavior

- Received files are cached locally in IndexedDB for a limited time.
- Cached inbox files can appear even if the signaling server is not currently
  connected.
- New phone uploads require the signaling server to be reachable.
- Long-term storage is handled by the church desktop or existing production
  folder structure after download.

## Production Notes

Vercel hosts the web app. Supabase Realtime can provide the signaling channel
for pairing and WebRTC negotiation. Production reliability still requires TURN.
