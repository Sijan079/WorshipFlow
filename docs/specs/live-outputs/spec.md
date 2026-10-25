# Live Outputs Spec

## Purpose

The Sermon Captions workspace screen uses one shared panel with **Audio setup**
and **Live captions** folder tabs above its top border. Audio setup provides a local booth-input check;
Live captions starts and stops translation from the selected input. Switching away from Audio setup ends the
local input test and releases its audio track. The screen does not require a worship service or
show legacy automation jobs. Starting live captions sends audio from the booth browser to Deepgram,
then recognized text through a workspace API to Azure Translator.

The tested Deepgram/Azure experiment remains as a standalone reference. The
site has a live session backend and a public, read-only `/captions/live/{id}` receiver. One session
  may run per workspace and it expires after three hours. It stores the latest 10 caption lines,
  shows them newest first in the operator preview and public viewer, and fades the oldest visible
  lines before they leave the rolling window. Stopping the broadcast keeps the final 10 lines
  on the public viewer for one hour; afterward the link returns no captions and the stored lines
  are removed on the next viewer request or session start. A membership-checked route issues a temporary Deepgram token;
the API key and Azure key stay on the server. The development Deepgram key issues
temporary tokens, and the local booth-browser caption flow has been tested with
spoken input; the Ui24R-to-PC line-in path still needs an in-service check.
If the booth browser's Deepgram socket drops, it keeps the selected microphone and
WorshipFlow session active while retrying automatically. Each replacement socket
gets a new short-lived token from an operator-only workspace route and a fresh
recorder over the same input. Retries use increasing delays up to 15 seconds and
resume the same caption line sequence and viewer link. Stop and session expiry
cancel retries. Audio that was not delivered during an interruption can be missing.
The booth reports its stream state when it changes and sends a heartbeat every five
seconds. The public viewer shows **Starting** while the stream connects, **Live**
while it receives audio, and **Connection interrupted** when the booth reports a
recoverable disconnect or its heartbeat is over 15 seconds old. A recovered
stream restores Live on the same viewer link. Fatal stream or access errors show
**Captions unavailable** so viewers do not mistake them for a brief interruption.
If the viewer's own connection fails, its page shows a separate retry message.
The latest ten lines remain visible during either interruption. Stop retains those
lines in the **Ended** state for one hour as described above.
The booth operator must keep this page open while broadcasting. Navigating the
same tab to another route unmounts the controller and ends the stream; a
separate tab or window keeps the caption page mounted while using other pages.
The viewer URL is unique to each session and can be shared with a pilot viewer;
anyone holding it can read that session's captions. Booth reconnection does not
change the URL. A permanent cross-service viewer URL is not implemented.
Owner/Admin access is automatic. Member access uses separate **View** and **Operate** module
actions, resolved from workspace Member defaults and personal allow/block overrides.
The old
`CAPTION_GENERATE` job endpoint remains a separate mock output and is not
exposed on the Sermon Captions screen. The [CaptionKit reference](./captionkit-reference.md)
records the public live caption workflow that informed integration.
The workspace captions route permits a same-origin browser microphone request
for the input check and live feed; other routes keep the site's microphone restriction.

Settings `?tab=usage` shows Owner/Admin the current UTC month's Azure metered
characters tracked by the app for this workspace, including a count of
successful requests that lacked a usable meter. A separate optional
`billing:read` key enables project-wide Deepgram balances. The view does not
enforce a broadcast cutoff. Source limitations are recorded in the
[Settings usage-view research](../../planning/sermon-captions-usage-settings-viability.md).

## Existing job infrastructure

- Automation job persistence.
- Generated output persistence.
- Caption/export style jobs.
- Output download workflows.

## Constraints

- Jobs and generated outputs are persisted records, not transient UI-only state.
- Keep workflow terminology centered on worship service preparation.
