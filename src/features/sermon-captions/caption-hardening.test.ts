import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPTION_RETENTION_MS, expiredCaptionSessionFilter, feedCacheControl } from "./caption-contract.ts";
import { canonicalOrigin, isLiveDatabaseInDev } from "./caption-environment.ts";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

// Hardening found in the pre-deploy security review (2026-10-27): the QR address, the public feed's
// cache, the session limit, retention, and the dev-against-live-database guard.
export function runCaptionHardeningTests() {
  // The QR code and link use the public address from APP_URL in production, never whatever address the
  // admin happened to browse (the team alias and per-deployment URLs sit behind a Vercel login).
  const alias = "https://worshipflow-artsijan-yu-s-projects.vercel.app";
  const publicHost = "https://sndev-worship-flow.vercel.app";
  assert.equal(canonicalOrigin({ appUrl: `${publicHost}/`, requestOrigin: alias, production: true }), publicHost);
  assert.equal(canonicalOrigin({ appUrl: `${publicHost}/some/path?x=1`, requestOrigin: alias, production: true }), publicHost);
  assert.equal(canonicalOrigin({ appUrl: "  " + publicHost + "  ", requestOrigin: alias, production: true }), publicHost);
  assert.equal(canonicalOrigin({ appUrl: undefined, requestOrigin: alias, production: true }), alias);
  assert.equal(canonicalOrigin({ appUrl: "not a url", requestOrigin: alias, production: true }), alias);
  assert.equal(canonicalOrigin({ appUrl: "ftp://example.com", requestOrigin: alias, production: true }), alias);
  // Production needs https. In development the address you are actually on wins, because APP_URL
  // names port 3000 while the dev server runs on another port.
  assert.equal(canonicalOrigin({ appUrl: "http://example.com", requestOrigin: alias, production: true }), alias);
  assert.equal(canonicalOrigin({ appUrl: "http://localhost:3000", requestOrigin: "http://localhost:3001", production: false }), "http://localhost:3001");

  // The public feed is cached briefly so its load does not grow with the audience: a second while
  // captions flow, ten seconds while waiting, thirty for a link that does not exist.
  assert.equal(feedCacheControl("live"), "public, s-maxage=1, stale-while-revalidate=1");
  for (const status of ["connecting", "interrupted", "error"] as const) assert.equal(feedCacheControl(status), "public, s-maxage=1, stale-while-revalidate=1");
  // No stale-while-revalidate while waiting: it would delay the moment "Live" appears after Start.
  assert.equal(feedCacheControl("waiting"), "public, s-maxage=10");
  assert.equal(feedCacheControl("ended"), "public, s-maxage=10");
  assert.equal(feedCacheControl("invalid"), "public, s-maxage=30");

  const feed = read("src", "app", "api", "captions", "live", "[token]", "route.ts");
  assert.match(feed, /feedCacheControl\(/);
  assert.doesNotMatch(feed, /no-store, private/);
  assert.match(feed, /"Cache-Control": "no-store"/);
  assert.match(feed, /Referrer-Policy/);

  // The proxy does nothing for these public paths, so it skips them. Otherwise every cached poll would
  // still run it first, and the cache would not save a function call.
  const proxy = read("src", "proxy.ts");
  const matcher = proxy.slice(proxy.indexOf("matcher:"));
  assert.match(matcher, /captions\/live/);
  assert.match(matcher, /api\/captions\/live/);
  assert.match(matcher, /_next\/static/);

  // The link and QR code come from one server-side address.
  const linkRoute = read("src", "app", "api", "caption-link", "route.ts");
  const regenerate = read("src", "app", "api", "caption-link", "regenerate", "route.ts");
  for (const route of [linkRoute, regenerate]) {
    assert.match(route, /canonicalOrigin\(/);
    assert.match(route, /process\.env\.APP_URL/);
    assert.match(route, /url,/);
  }
  assert.match(read("src", "features", "sermon-captions", "use-caption-link.ts"), /info\.url/);
  assert.match(read(".env.example"), /Sermon Captions QR code[\s\S]{0,200}\nAPP_URL=/);

  // Azure refuses over-quota requests with a plain, specific message, kept apart from throttling.
  const server = read("src", "features", "sermon-captions", "caption-server.ts");
  assert.match(server, /CaptionProviderQuotaError/);
  assert.match(server, /429/);
  const hook = read("src", "features", "sermon-captions", "use-caption-session.ts");
  assert.match(hook, /status === 429/);

  // A session lasts up to four hours, so a long service is not cut off.
  assert.match(server, /CAPTION_SESSION_MS = 4 \* 60 \* 60 \* 1000/);
  assert.doesNotMatch(read("src", "features", "sermon-captions", "caption-contract.ts"), /three-hour/);

  // Retention: expired lines are also erased by the daily job, matching exactly what the feed treats as gone.
  const now = new Date("2026-10-27T12:00:00Z");
  assert.deepEqual(expiredCaptionSessionFilter(now), {
    OR: [
      { status: "ENDED", expiresAt: { lte: now } },
      { status: "LIVE", expiresAt: { lte: new Date(now.getTime() - CAPTION_RETENTION_MS) } },
    ],
  });
  const keepAlive = read("src", "app", "api", "internal", "keep-alive", "route.ts");
  assert.match(keepAlive, /captionLine\.deleteMany/);
  assert.match(keepAlive, /expiredCaptionSessionFilter\(/);
  assert.match(keepAlive, /captionLinesRemoved/);
  const readme = read("README.md");
  const captionsReadme = readme.slice(readme.indexOf("### Sermon Captions"));
  assert.match(captionsReadme, /four hours/);
  assert.doesNotMatch(captionsReadme, /three hours/);
  assert.match(captionsReadme, /erased within a day/);
  assert.match(captionsReadme, /APP_URL/);

  // Dev against the live database: this computer is connected to production data, so test captions
  // would appear on the real congregation link. The server says so, and Start asks first.
  const live = "postgresql://user:pass@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres";
  assert.equal(isLiveDatabaseInDev(live, "development"), true);
  assert.equal(isLiveDatabaseInDev(live, undefined), true);
  assert.equal(isLiveDatabaseInDev(live, "production"), false);
  assert.equal(isLiveDatabaseInDev("postgresql://postgres:postgres@127.0.0.1:54322/postgres", "development"), false);
  assert.equal(isLiveDatabaseInDev("postgresql://postgres:postgres@localhost:54322/postgres", "development"), false);
  assert.equal(isLiveDatabaseInDev("postgresql://postgres:postgres@host.docker.internal:54322/postgres", "development"), false);
  assert.equal(isLiveDatabaseInDev("", "development"), false);
  assert.equal(isLiveDatabaseInDev(undefined, "development"), false);
  assert.equal(isLiveDatabaseInDev("not a url", "development"), false);
  const sessions = read("src", "app", "api", "caption-sessions", "route.ts");
  assert.match(sessions, /isLiveDatabaseInDev\(/);
  assert.match(sessions, /devAgainstLiveDatabase/);
}
