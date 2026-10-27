// Acts as one listener and measures how old each caption is when it reaches you.
//
//   npm run measure:captions -- --link https://your-site/captions/live/<the link from Share> [--interval 2000] [--seconds 300]
//
// Start captions, speak, and watch. Press Ctrl+C for a summary. "lag" is the time from the server storing
// a caption to the answer that first carried it: it includes the wait for the next check and the edge cache,
// and uses only the server's own clock. It leaves out the last network hop to you, usually under 200 ms.
// Only the start of the secret link is ever printed.

import { summarize } from "../src/features/sermon-captions/caption-metrics.ts";

const args = process.argv.slice(2);

function option(name: string) {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

const link = option("--link");
if (!link) {
  console.error("Missing --link. Copy the listener link from the Share button and pass it as --link <link>.");
  process.exit(1);
}

const intervalMs = Math.max(500, Number(option("--interval") ?? 2000));
const stopAfterMs = option("--seconds") ? Number(option("--seconds")) * 1000 : Infinity;
const url = new URL(link);
const secret = url.pathname.split("/").filter(Boolean).pop() ?? "";
const feedUrl = `${url.origin}/api/captions/live/${secret}`;
const shown = `${url.origin}/captions/live/${secret.slice(0, 4)}…`;

const seen = new Set<string>();
const lags: number[] = [];
let firstPoll = true;
let polls = 0;
let stopped = false;

function pad(value: string | number, width: number) {
  return String(value).padStart(width);
}

async function poll() {
  const response = await fetch(feedUrl, { cache: "no-store" });
  const receivedAt = Date.now();
  polls += 1;
  if (!response.ok) {
    console.log(`  feed answered ${response.status}`);
    return;
  }
  const cache = response.headers.get("x-vercel-cache") ?? "-";
  const age = response.headers.get("age") ?? "0";
  const body = await response.json() as { status?: string; serverNow?: number; lines?: Array<{ line: number; english: string; final: boolean; updatedAt?: string }> };
  for (const item of body.lines ?? []) {
    if (!item.final || !item.updatedAt) continue;
    const key = `${item.line}:${item.updatedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (firstPoll) continue; // captions that were already there are not a measurement
    // Both times come from the server's own clock, so this computer's clock does not matter: how old the
    // caption was when the answer was made, plus how long the answer sat in the cache.
    const lag = typeof body.serverNow === "number" ? body.serverNow - Date.parse(item.updatedAt) + Number(age) * 1000 : receivedAt - Date.parse(item.updatedAt);
    lags.push(lag);
    console.log(`  line ${pad(item.line, 4)}  lag ${pad(lag, 5)} ms   cache ${pad(cache, 5)} age ${pad(age, 2)}s   ${item.english.slice(0, 40)}`);
  }
  firstPoll = false;
}

function report() {
  const lag = summarize(lags);
  console.log("\nSummary");
  console.log(`  checks made: ${polls}, captions measured: ${lags.length}`);
  if (lag) console.log(`  lag (ms): median ${lag.median}, 95th percentile ${lag.p95}, slowest ${lag.max}, fastest ${lag.min}, average ${lag.mean}`);
  else console.log("  no new captions arrived while measuring. Start captions and speak, then try again.");
}

console.log(`Measuring ${shown} every ${intervalMs} ms. Speak, then press Ctrl+C for the summary.`);
process.on("SIGINT", () => {
  stopped = true;
  report();
  process.exit(0);
});

const startedAt = Date.now();
while (!stopped && Date.now() - startedAt < stopAfterMs) {
  try {
    await poll();
  } catch (error) {
    console.log(`  could not reach the feed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
report();
