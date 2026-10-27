import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPTION_SESSION_MS, EXTEND_WINDOW_MS, extendedExpiresAt, extensionWindowOpen, feedCacheControl } from "./caption-contract.ts";
import { shareableOrigin } from "./caption-environment.ts";
import { captionBudget, parseCharacterCap } from "./caption-usage.ts";
import { captionTitle, formatElapsed } from "./caption-ui.ts";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

// The captions background job and the review's open cases (decided with the owner, 2026-10-27).
export function runCaptionBackgroundTests() {
  // QR origin: production shares only the public https address. With APP_URL missing or unusable there
  // is no link to share, rather than one that opens a Vercel login for the congregation.
  const publicHost = "https://sndev-worship-flow.vercel.app";
  const alias = "https://worshipflow-artsijan-yu-s-projects.vercel.app";
  assert.equal(shareableOrigin({ appUrl: `${publicHost}/x?y=1`, requestOrigin: alias, production: true }), publicHost);
  for (const appUrl of [undefined, "", "  ", "not a url", "http://example.com", "ftp://example.com"]) {
    assert.equal(shareableOrigin({ appUrl, requestOrigin: alias, production: true }), null, String(appUrl));
  }
  assert.equal(shareableOrigin({ appUrl: undefined, requestOrigin: "http://localhost:3001", production: false }), "http://localhost:3001");
  for (const file of [["src", "app", "api", "caption-link", "route.ts"], ["src", "app", "api", "caption-link", "regenerate", "route.ts"]]) {
    assert.match(read(...file), /shareableOrigin\(/, file.join("/"));
    assert.match(read(...file), /APP_URL/, file.join("/"));
  }
  assert.match(read("src", "features", "sermon-captions", "share-dialog.tsx"), /error/i);

  // Feed caching: a second while live, ten seconds while waiting, a minute once ended.
  assert.equal(feedCacheControl("live"), "public, s-maxage=1, stale-while-revalidate=1");
  assert.equal(feedCacheControl("waiting"), "public, s-maxage=10");
  assert.equal(feedCacheControl("ended"), "public, s-maxage=60");

  // Cost cap: warn from 80%, block starting at 100%. A live session is never cut off by the cap.
  assert.equal(parseCharacterCap(undefined), 2_000_000);
  assert.equal(parseCharacterCap("500000"), 500_000);
  assert.equal(parseCharacterCap("abc"), 2_000_000);
  assert.equal(parseCharacterCap("-5"), 2_000_000);
  assert.deepEqual(captionBudget(0, 1000), { state: "ok", percent: 0, used: 0, cap: 1000 });
  assert.equal(captionBudget(799, 1000).state, "ok");
  assert.equal(captionBudget(800, 1000).state, "warning");
  assert.equal(captionBudget(999, 1000).state, "warning");
  assert.equal(captionBudget(1000, 1000).state, "blocked");
  assert.equal(captionBudget(5000, 1000).percent, 100);
  const sessions = read("src", "app", "api", "caption-sessions", "route.ts");
  assert.match(sessions, /workspaceCaptionBudget\(/);
  assert.match(sessions, /status: 403/);
  assert.doesNotMatch(read("src", "app", "api", "caption-sessions", "[id]", "lines", "route.ts"), /CaptionBudget\(/, "the cap never stops a running session");

  // Session length: four hours, with an offer to extend in the last fifteen minutes.
  assert.equal(CAPTION_SESSION_MS, 4 * 60 * 60 * 1000);
  assert.equal(EXTEND_WINDOW_MS, 15 * 60 * 1000);
  const expires = new Date("2026-10-27T12:00:00Z");
  assert.equal(extensionWindowOpen(expires, new Date("2026-10-27T11:44:59Z")), false);
  assert.equal(extensionWindowOpen(expires, new Date("2026-10-27T11:45:00Z")), true);
  assert.equal(extensionWindowOpen(expires, new Date("2026-10-27T12:00:00Z")), false);
  assert.equal(extendedExpiresAt(expires).toISOString(), "2026-10-27T16:00:00.000Z");
  const extend = join("src", "app", "api", "caption-sessions", "[id]", "extend", "route.ts");
  assert.ok(existsSync(join(process.cwd(), extend)), extend);
  const extendSource = read(extend);
  assert.match(extendSource, /requireCaptionAction\("OPERATE"\)/);
  assert.match(extendSource, /validOperatorToken\(/);
  assert.match(extendSource, /extensionWindowOpen\(/);

  // The live bar and the tab title.
  assert.equal(formatElapsed(0), "0:00");
  assert.equal(formatElapsed(65_000), "1:05");
  assert.equal(formatElapsed(3_725_000), "1:02:05");
  assert.equal(formatElapsed(-5), "0:00");
  assert.equal(captionTitle("Services", true), "● LIVE · Services");
  assert.equal(captionTitle("● LIVE · Services", true), "● LIVE · Services");
  assert.equal(captionTitle("● LIVE · Services", false), "Services");
  assert.equal(captionTitle("Services", false), "Services");
  assert.match(read("src", "features", "sermon-captions", "caption-live-button.tsx"), /formatElapsed\(/);
  assert.match(read("src", "features", "sermon-captions", "caption-engine.tsx"), /captionTitle\(/);

  // The live-database question needs a tick before "Yes" is enabled.
  const dialog = read("src", "features", "sermon-captions", "dev-database-dialog.tsx");
  assert.match(dialog, /type="checkbox"/);
  assert.match(dialog, /disabled=\{!understood\}/);
}
