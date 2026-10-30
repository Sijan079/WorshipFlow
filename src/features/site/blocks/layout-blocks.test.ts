import assert from "node:assert/strict";
import { test } from "node:test";
import { PageInputSchema, SITE_LIMITS, SiteBlockSchema, countBlocks } from "./block-validation.ts";

const text = (value = "Hello") => ({ type: "PARAGRAPH" as const, content: { runs: [{ text: value }], align: "left" as const, size: "normal" as const } });
const section = (over: Record<string, unknown> = {}, blocks: unknown[] = [text()]) => ({
  type: "SECTION",
  content: { background: "tinted", overlay: "medium", padding: "medium", inner: "content", width: "full", blocks, ...over },
});
const ok = (value: unknown) => SiteBlockSchema.safeParse(value).success;

test("a Section holds blocks and has a background, padding, inner width and band width", () => {
  assert.ok(ok(section()));
  for (const background of ["none", "tinted", "dark", "accent"]) assert.ok(ok(section({ background })), background);
  for (const padding of ["small", "medium", "large"]) assert.ok(ok(section({ padding })), padding);
  for (const inner of ["content", "wide"]) assert.ok(ok(section({ inner })), inner);
  for (const width of ["wide", "full"]) assert.ok(ok(section({ width })), width);
});

test("an unknown background, padding or width is refused", () => {
  assert.equal(ok(section({ background: "rainbow" })), false);
  assert.equal(ok(section({ padding: "huge" })), false);
  assert.equal(ok(section({ width: "content" })), false, "a band is wide or full, never narrower than the page text");
  assert.equal(ok(section({ color: "#ff0000" })), false, "no free colours");
});

test("a picture background needs a picture of the church's own, and others do not", () => {
  assert.equal(ok(section({ background: "picture" })), false);
  assert.ok(ok(section({ background: "picture", picture: "site/3f2b8c1e-5d4a-4e7b-9c6a-1b2c3d4e5f60.webp" })));
  assert.equal(ok(section({ background: "picture", picture: "https://evil.example/x.webp" })), false);
  assert.ok(ok(section({ background: "tinted" })));
});

test("a Section cannot contain another Section", () => {
  assert.equal(ok(section({}, [section()])), false);
});

test("blocks inside a Section follow the same rules as blocks on the page", () => {
  assert.equal(ok(section({}, [{ type: "BUTTON", content: { label: "Go", link: { kind: "url", url: "javascript:alert(1)" }, align: "left" } }])), false);
  assert.equal(ok(section({}, [{ type: "HTML", content: { html: "<b>x</b>" } }])), false);
  assert.ok(ok(section({}, [{ type: "ANNOUNCEMENTS_LIST", content: {} }, { type: "SERVICE_TIMES", content: { lines: ["Sunday 9:00 AM"] } }])));
});

test("a Section holds at most 30 blocks", () => {
  assert.equal(SITE_LIMITS.sectionBlocks, 30);
  assert.ok(ok(section({}, Array.from({ length: 30 }, () => text()))));
  assert.equal(ok(section({}, Array.from({ length: 31 }, () => text()))), false);
});

test("a picture can be content, wide or full width, and text blocks cannot choose a width", () => {
  const picture = (width?: string) => ({ type: "IMAGE", content: { path: "site/3f2b8c1e-5d4a-4e7b-9c6a-1b2c3d4e5f60.webp", alt: "x", align: "left", ...(width ? { width } : {}) } });
  assert.ok(ok(picture()));
  for (const width of ["content", "wide", "full"]) assert.ok(ok(picture(width)), width);
  assert.equal(ok(picture("huge")), false);
  assert.equal(ok({ type: "PARAGRAPH", content: { runs: [{ text: "x" }], align: "left", size: "normal", width: "full" } }), false);
  assert.equal(ok({ type: "HEADING", content: { text: "x", level: 2, align: "left", width: "wide" } }), false);
});

test("blocks are counted at every level, and a page holds at most 100", () => {
  assert.equal(SITE_LIMITS.blocksPerPage, 100);
  assert.equal(countBlocks([text(), section({}, [text(), text()])] as never), 4, "the Section itself counts, and so does what is inside");
  const full = Array.from({ length: 100 }, () => text());
  assert.ok(PageInputSchema.safeParse({ title: "Home", blocks: full }).success);
  assert.equal(PageInputSchema.safeParse({ title: "Home", blocks: [...full, text()] }).success, false);
  // 20 sections of 5 blocks each is 120 in all: refused although only 20 are at the top.
  const sections = Array.from({ length: 20 }, () => section({}, Array.from({ length: 5 }, () => text())));
  assert.equal(PageInputSchema.safeParse({ title: "Home", blocks: sections }).success, false);
});
