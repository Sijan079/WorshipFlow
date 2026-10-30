import assert from "node:assert/strict";
import { test } from "node:test";
import { PageInputSchema, SITE_LIMITS, SiteBlockSchema, countBlocks } from "./block-validation.ts";

const picture = "site/3f2b8c1e-5d4a-4e7b-9c6a-1b2c3d4e5f60.webp";
const slide = (over: Record<string, unknown> = {}) => ({ title: "Children", text: "Bible stories and games.", ...over });
const carousel = (over: Record<string, unknown> = {}, slides: unknown[] = [slide(), slide({ title: "Youth" })]) => ({
  type: "CAROUSEL",
  content: { slides, perView: 3, width: "wide", ...over },
});
const section = (blocks: unknown[]) => ({ type: "SECTION", content: { background: "tinted", overlay: "medium", padding: "medium", inner: "wide", width: "full", blocks } });
const ok = (value: unknown) => SiteBlockSchema.safeParse(value).success;

test("a Carousel holds two to twelve cards, each with a title, and optionally a line, a picture and a button", () => {
  assert.equal(SITE_LIMITS.carouselSlides, 12);
  assert.ok(ok(carousel()));
  assert.ok(ok(carousel({}, [slide({ text: undefined }), slide({ picture }), slide({ button: { label: "Learn more", link: { kind: "page", slug: "children" } } })])));
  assert.equal(ok(carousel({}, [slide()])), false, "one card is not a carousel");
  assert.ok(ok(carousel({}, Array.from({ length: 12 }, (_, i) => slide({ title: `Card ${i}` })))));
  assert.equal(ok(carousel({}, Array.from({ length: 13 }, (_, i) => slide({ title: `Card ${i}` })))), false);
});

test("every card needs a title, and the words are limited", () => {
  assert.equal(ok(carousel({}, [slide({ title: "" }), slide()])), false);
  assert.equal(ok(carousel({}, [slide({ title: "   " }), slide()])), false);
  assert.equal(ok(carousel({}, [slide({ title: "x".repeat(61) }), slide()])), false);
  assert.equal(ok(carousel({}, [slide({ text: "x".repeat(201) }), slide()])), false);
});

test("a card's picture is one of the church's own, and its button follows the usual link rules", () => {
  assert.equal(ok(carousel({}, [slide({ picture: "https://evil.example/x.webp" }), slide()])), false);
  assert.equal(ok(carousel({}, [slide({ picture: "site/../secret.webp" }), slide()])), false);
  assert.equal(ok(carousel({}, [slide({ button: { label: "Go", link: { kind: "url", url: "javascript:alert(1)" } } }), slide()])), false);
  assert.equal(ok(carousel({}, [slide({ button: { label: "", link: { kind: "page", slug: "x" } } }), slide()])), false);
});

test("how many cards show at once is two, three or four, and the width is content, wide or full", () => {
  for (const perView of [2, 3, 4]) assert.ok(ok(carousel({ perView })), String(perView));
  assert.equal(ok(carousel({ perView: 1 })), false);
  assert.equal(ok(carousel({ perView: 5 })), false);
  for (const width of ["content", "wide", "full"]) assert.ok(ok(carousel({ width })), width);
  assert.equal(ok(carousel({ width: "huge" })), false);
});

test("a Carousel can have a name for screen readers, and accepts no colours, styles or HTML", () => {
  assert.ok(ok(carousel({ label: "Our ministries" })));
  assert.equal(ok(carousel({ label: "x".repeat(81) })), false);
  assert.equal(ok(carousel({ color: "#ff0000" })), false);
  assert.equal(ok(carousel({ html: "<b>x</b>" })), false);
  assert.equal(ok(carousel({}, [slide({ html: "<b>x</b>" }), slide()])), false);
});

test("a Carousel goes on the page or inside a Section, never inside a column", () => {
  assert.ok(ok(section([carousel()])));
  const columns = { type: "COLUMNS", content: { valign: "top", cards: false, width: "wide", columns: [{ blocks: [carousel()] }, { blocks: [] }] } };
  assert.equal(ok(columns), false);
  assert.ok(PageInputSchema.safeParse({ title: "Home", blocks: [carousel()] }).success);
});

test("a Carousel counts once, and so does each of its cards, towards the 100 blocks of a page", () => {
  assert.equal(countBlocks([carousel({}, [slide(), slide(), slide()])] as never), 4);
  assert.equal(countBlocks([section([carousel({}, [slide(), slide()])])] as never), 4, "Section, Carousel and two cards");
  const many = Array.from({ length: 8 }, () => carousel({}, Array.from({ length: 12 }, (_, i) => slide({ title: `Card ${i}` }))));
  assert.equal(PageInputSchema.safeParse({ title: "Home", blocks: many }).success, false, "104 in all");
});
