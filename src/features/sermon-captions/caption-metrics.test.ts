import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createStageTimer, recognitionLagMs, serverTimingHeader, summarize } from "./caption-metrics.ts";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

// Where does the time go between someone speaking and a listener reading it? Each stage is measured:
// the booth (how long the words took to be recognised, and the round trip to our server), the server
// (access check, database, Azure, writes), and the listener (how old a caption is when it arrives).
export function runCaptionMetricsTests() {
  // A stage timer reports how long each step took, and the total.
  let clock = 1000;
  const timer = createStageTimer(() => clock);
  clock += 12.34;
  timer.mark("access");
  clock += 80;
  timer.mark("translate");
  clock += 5;
  assert.deepEqual(timer.summary(), { access: 12.3, translate: 80, total: 97.3 });

  assert.equal(serverTimingHeader({ access: 12.3, translate: 80, total: 97.3 }), "access;dur=12.3, translate;dur=80, total;dur=97.3");

  // How long the recogniser took: the time since audio began, minus how far into the audio the words end.
  assert.equal(recognitionLagMs({ streamElapsedMs: 5200, start: 3.9, duration: 0.8 }), 500);
  assert.equal(recognitionLagMs({ streamElapsedMs: 1000, start: 3.9, duration: 0.8 }), 0, "never negative");
  assert.equal(recognitionLagMs({ streamElapsedMs: 5200, start: undefined, duration: 0.8 }), undefined);
  assert.equal(recognitionLagMs({ streamElapsedMs: 5200, start: 3.9, duration: undefined }), undefined);

  // A summary for the report: the middle value and the slow end matter more than the average.
  assert.equal(summarize([]), null);
  assert.deepEqual(summarize([100, 200, 300, 400, 1000]), { count: 5, min: 100, median: 300, p95: 1000, max: 1000, mean: 400 });
  assert.deepEqual(summarize([5]), { count: 1, min: 5, median: 5, p95: 5, max: 5, mean: 5 });

  // The server logs one line per published caption, with every stage, and sends the same as Server-Timing.
  const route = read("src", "app", "api", "caption-sessions", "[id]", "lines", "route.ts");
  assert.match(route, /createStageTimer\(\)/);
  for (const stage of ["access", "lookup", "translate", "save", "verify"]) {
    assert.match(route, new RegExp(`mark\\("${stage}"\\)`), `stage ${stage}`);
  }
  assert.match(route, /event: "captions\.publish"/);
  assert.match(route, /console\.info\(JSON\.stringify\(/);
  assert.match(route, /"Server-Timing": serverTimingHeader\(/);
  assert.match(route, /timing: z\.object\(/);
  assert.match(route, /recognitionMs/);
  assert.match(route, /previousRoundTripMs/);
  // Speed: independent database calls run together instead of one after another.
  assert.match(route, /Promise\.all\(\[\s*prisma\.captionSession\.findFirst[\s\S]*?prisma\.captionLine\.findUnique/, "session and existing line are fetched together");
  assert.match(route, /Promise\.all\(\[[\s\S]*?captionUsageDay\.upsert[\s\S]*?captionLine\.upsert/, "usage and write run together");
  assert.match(route, /Promise\.all\(\[[\s\S]*?captionSession\.findUnique[\s\S]*?captionLine\.deleteMany/, "check and trim run together");
  // The login check no longer writes to the database on every request, and finds the membership in one query.
  const security = read("src", "lib", "security-context.ts");
  assert.match(security, /authProviderId: data\.user\.id \} \}\);\s*if \(known/, "known users are read, not upserted");
  assert.match(security, /workspaceMembership\.findFirst\(\{\s*where: \{ userId: user\.id, workspace: \{ slug: workspaceSlug \} \}/, "workspace and membership in one query");
  // The function runs next to the database (Seoul).
  assert.match(read("vercel.json"), /"regions": \["icn1"\]/);
  // The log never carries caption text or any token: only numbers, the session and line.
  const logStart = route.indexOf('event: "captions.publish"');
  const logBlock = route.slice(logStart, route.indexOf("}))", logStart));
  assert.doesNotMatch(logBlock, /source|english|operator|token|authorization/i);

  // The booth measures how long recognition took and how long the previous publish took.
  const hook = read("src", "features", "sermon-captions", "use-caption-session.ts");
  assert.match(hook, /recognitionLagMs\(/);
  assert.match(hook, /streamStartRef/);
  assert.match(hook, /lastRoundTripRef/);
  assert.match(hook, /performance\.now\(\)/);
  const api = read("src", "features", "sermon-captions", "caption-session-api.ts");
  assert.match(api, /timing: \{ recognitionMs: update\.recognitionMs, previousRoundTripMs \}/);
  assert.match(read("src", "features", "sermon-captions", "caption-contract.ts"), /recognitionMs\?: number/);

  // The public feed says when each caption was stored and when the response was made, so a listener
  // (or the measuring script) can tell how old a caption is on arrival.
  const feed = read("src", "app", "api", "captions", "live", "[token]", "route.ts");
  assert.match(feed, /updatedAt: true/);
  assert.match(feed, /serverNow: Date\.now\(\)/);

  // The listener script and its instructions.
  assert.equal(existsSync(join(process.cwd(), "scripts", "measure-caption-latency.ts")), true);
  const script = read("scripts", "measure-caption-latency.ts");
  assert.match(script, /summarize\(/);
  assert.match(script, /--link/);
  assert.match(script, /SIGINT/);
  assert.match(script, /x-vercel-cache/i);
  // The script prints only the start of the secret link, never all of it.
  assert.doesNotMatch(script, /console\.log\([^)]*\btoken\b[^)]*\)/);
  assert.match(read("package.json"), /"measure:captions": "node --experimental-strip-types scripts\/measure-caption-latency\.ts"/);
  const doc = read("docs", "worship", "captions-latency.md");
  for (const phrase of ["How to measure", "recognitionMs", "listener", "access", "translate", "Where to improve"]) {
    assert.ok(doc.includes(phrase), `captions-latency.md should cover: ${phrase}`);
  }
}
