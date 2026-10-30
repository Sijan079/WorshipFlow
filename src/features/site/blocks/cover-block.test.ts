import assert from "node:assert/strict";
import { test } from "node:test";
import { COVER_FOCUS_POINTS, PageInputSchema, SiteBlockSchema, countBlocks } from "./block-validation.ts";
import { COVER_OVERLAY, coverFocusPosition } from "./cover-style.ts";

const picture = "site/3f2b8c1e-5d4a-4e7b-9c6a-1b2c3d4e5f60.webp";
const cover = (over: Record<string, unknown> = {}) => ({
  type: "COVER",
  content: { headline: "Welcome home", overlay: "medium", height: "tall", align: "center", focus: "center", width: "full", buttons: [], ...over },
});
const ok = (value: unknown) => SiteBlockSchema.safeParse(value).success;
const button = (over: Record<string, unknown> = {}) => ({ label: "Plan your visit", link: { kind: "page", slug: "visit" }, style: "filled", ...over });

test("a Cover has a headline, an optional line, a picture, a look and up to two buttons", () => {
  assert.ok(ok(cover()));
  assert.ok(ok(cover({ text: "Come as you are.", picture, buttons: [button(), button({ label: "Watch online", style: "outline", link: { kind: "url", url: "https://example.org/live" } })] })));
});

test("the picture is optional, and when given it must be one of the church's own", () => {
  assert.ok(ok(cover()), "no picture: the accent colour is used");
  assert.equal(ok(cover({ picture: "https://evil.example/x.webp" })), false);
  assert.equal(ok(cover({ picture: "site/../secret.webp" })), false);
});

test("the headline is required, and the words are limited", () => {
  assert.equal(ok(cover({ headline: "" })), false);
  assert.equal(ok(cover({ headline: "   " })), false);
  assert.equal(ok(cover({ headline: "x".repeat(121) })), false);
  assert.equal(ok(cover({ text: "x".repeat(301) })), false);
});

test("overlay, height, alignment, crop point and width only take the offered choices", () => {
  for (const overlay of ["light", "medium", "strong"]) assert.ok(ok(cover({ overlay })), overlay);
  for (const height of ["medium", "tall", "screen"]) assert.ok(ok(cover({ height })), height);
  for (const align of ["left", "center"]) assert.ok(ok(cover({ align })), align);
  for (const width of ["wide", "full"]) assert.ok(ok(cover({ width })), width);
  for (const focus of COVER_FOCUS_POINTS) assert.ok(ok(cover({ focus })), focus);
  assert.equal(COVER_FOCUS_POINTS.length, 9);
  assert.equal(ok(cover({ overlay: "none" })), false, "the overlay can never be switched off");
  assert.equal(ok(cover({ height: "huge" })), false);
  assert.equal(ok(cover({ align: "right" })), false);
  assert.equal(ok(cover({ width: "content" })), false);
  assert.equal(ok(cover({ focus: "middle" })), false);
});

test("a Cover has at most two buttons, and each follows the usual link rules", () => {
  assert.ok(ok(cover({ buttons: [button(), button()] })));
  assert.equal(ok(cover({ buttons: [button(), button(), button()] })), false);
  assert.equal(ok(cover({ buttons: [button({ link: { kind: "url", url: "javascript:alert(1)" } })] })), false);
  assert.equal(ok(cover({ buttons: [button({ label: "" })] })), false);
  assert.equal(ok(cover({ buttons: [button({ style: "glowing" })] })), false);
});

test("a Cover accepts no colours, styles or HTML", () => {
  assert.equal(ok(cover({ color: "#ff0000" })), false);
  assert.equal(ok(cover({ html: "<b>x</b>" })), false);
  assert.equal(ok(cover({ buttons: [button({ color: "red" })] })), false);
});

test("a Cover sits on the page itself, never inside a Section, and counts as one block", () => {
  const section = { type: "SECTION", content: { background: "tinted", overlay: "medium", padding: "medium", inner: "content", width: "full", blocks: [cover()] } };
  assert.equal(ok(section), false);
  assert.equal(countBlocks([cover()] as never), 1);
  assert.ok(PageInputSchema.safeParse({ title: "Home", blocks: [cover()] }).success);
});

test("every crop point maps to a position, and the overlay is always strong enough to read white words", () => {
  assert.equal(coverFocusPosition("top-left"), "0% 0%");
  assert.equal(coverFocusPosition("center"), "50% 50%");
  assert.equal(coverFocusPosition("bottom-right"), "100% 100%");
  assert.equal(coverFocusPosition("top"), "50% 0%");
  assert.equal(coverFocusPosition("left"), "0% 50%");
  for (const focus of COVER_FOCUS_POINTS) assert.match(coverFocusPosition(focus), /^\d+% \d+%$/, focus);
  // The lightest overlay still darkens the picture by about a third, so white words stay readable on a bright photo.
  assert.ok(COVER_OVERLAY.light >= 0.35);
  assert.ok(COVER_OVERLAY.light < COVER_OVERLAY.medium && COVER_OVERLAY.medium < COVER_OVERLAY.strong);
});
