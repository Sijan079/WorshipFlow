# Captions speed: where the time goes

A caption's journey, and what measures each part. Nothing here changes how captions work: it only records
timings so we can see where to improve instead of guessing.

```
speaker  ->  booth recognises the words  ->  booth sends them to our server  ->  server translates and stores
         ->  edge cache  ->  listener's page checks  ->  listener reads
```

## How to measure

1. Make sure the version with the timing is deployed.
2. On the booth computer, start captions and speak a few sentences at a normal pace. Pause between sentences.
3. On any other computer (ideally one outside the church, since that is what listeners have), run
   `npm run measure:captions -- --link <the listener link from the Share button>`.
   It prints each new caption with its **listener lag**, and a summary when you press Ctrl+C.
4. Ask for the server and booth numbers: they are logged once per caption as a JSON line with
   `"event":"captions.publish"` in the Vercel logs (Logs tab, search `captions.publish`), or ask Claude to
   read them.

## What each number means

| Number | Where it comes from | Meaning |
|---|---|---|
| `booth.recognitionMs` | the booth, from Deepgram's timestamps | how long after the words ended the recogniser returned them |
| `booth.previousRoundTripMs` | the booth | how long the booth waited for our server to answer the previous caption |
| `ms.access` | server | login check, membership and permission |
| `ms.lookup` | server | finding the live session and the line already stored (together) |
| `ms.translate` | server | Azure Translator |
| `ms.save` | server | storing the caption and counting translated characters (together) |
| `ms.verify` | server | confirming the session is still live and deleting old lines (together) |
| `ms.total` | server | everything above |
| listener `lag` | the script | from the server storing a caption to the script receiving it: waiting for the next check, plus the edge cache |

The server also sends the same numbers in a `Server-Timing` header, visible in a browser's developer tools.
The logs contain only numbers and the first eight characters of the session id: never caption text, never a
token.

## Where to improve

Read the numbers from largest to smallest. As a rough guide (to be replaced by what we measure):

- **listener lag is the largest.** The wait for the next check and the edge cache dominate. Check more often
  (the cache already absorbs it), or push captions to listeners instead of making them ask (Supabase Realtime).
- **`ms.access` is large.** The login check goes to Supabase Auth on every caption. Shorten it (cache the
  result for the session) or move the check once per session.
- **`ms.session`, `existing`, `usage`, `write`, `check`, `trim` add up.** These are database round trips, one
  after another, from the function's region to the database. Run them in parallel, drop the ones that are not
  needed, or move the function next to the database (Seoul).
- **`ms.translate` is large.** Azure is slow or far; check its region, or translate in larger pieces.
- **`booth.recognitionMs` is large.** Deepgram's end-of-speech wait (`endpointing=500`) and the recorder's
  chunking. Lower the endpointing, or publish partial results while a sentence is still being spoken.
- **`previousRoundTripMs` is much larger than `ms.total`.** The network between the booth and Vercel is slow.

Record what we measured, and what we changed, here:

| Date | Median lag | Slowest stage | Change |
|---|---|---|---|
| 2026-10-27 | not measured yet | `ms.access` about 500 ms; six database calls of about 70 ms each (Hong Kong to Seoul); server total about 1,050 ms | Function moved to Seoul (`icn1`); independent calls run together; known users are no longer written on every request. Re-measure to confirm. |
