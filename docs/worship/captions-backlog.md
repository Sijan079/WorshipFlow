# Sermon Captions backlog

Ideas decided or discussed but not built. Revisit after the stable link ships.

## Pause captions (likely next)

Start means "live to everyone with the link", so the microphone's chatter before the service is
published as soon as Start is pressed. A **Pause captions** button would keep the session and
the link up, show listeners "Captions are paused", and publish nothing until the operator
resumes. This is the direct answer to the chatter concern; build it before any audio filtering.

## Noise suppression switches

From a web page the browser can apply noise suppression, echo cancellation, and automatic gain
to the microphone before it goes to Deepgram (`getUserMedia` audio constraints). Those are tuned
for voice calls and can hurt a mixer line-in feed, so they should be visible switches in the
audio dialog, not hidden defaults. Deepgram's model already tolerates some noise. Test with the
real Ui24R feed before deciding a default.

## Other

- Count of people reading now, shown to the operator (needs a viewer heartbeat).
- Rate limiting on the public feed if readers grow past a few dozen.
- Generic wording for the booth notes in the audio dialog (they name the Ui24R mixer, which is
  specific to one church).
