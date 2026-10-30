import assert from "node:assert/strict";
import { test } from "node:test";
import { PageInputSchema, SiteBlockSchema, SITE_LIMITS, pageSlugFromTitle } from "./block-validation.ts";

const ok = (value: unknown) => SiteBlockSchema.safeParse(value).success;

test("every block type in the first version has a shape", () => {
  assert.ok(ok({ type: "PARAGRAPH", content: { runs: [{ text: "Hello" }], align: "left", size: "normal" } }));
  assert.ok(ok({ type: "HEADING", content: { text: "Welcome", level: 2, align: "center" } }));
  assert.ok(ok({ type: "LIST", content: { ordered: false, items: ["One", "Two"] } }));
  assert.ok(ok({ type: "QUOTE", content: { text: "Be kind.", cite: "Ephesians 4:32" } }));
  assert.ok(ok({ type: "IMAGE", content: { path: "site/abc.webp", alt: "The sanctuary", align: "center" } }));
  assert.ok(ok({ type: "BUTTON", content: { label: "Plan your visit", link: { kind: "page", slug: "visit" }, align: "left" } }));
  assert.ok(ok({ type: "SPACER", content: { size: "medium" } }));
  assert.ok(ok({ type: "SERVICE_TIMES", content: { lines: ["Sunday 9:00 AM"] } }));
  for (const type of ["ANNOUNCEMENTS_LIST", "EVENTS_LIST", "CONTACT"]) assert.ok(ok({ type, content: {} }), type);
});

test("an unknown block type, or the old rich text type, is refused", () => {
  assert.equal(ok({ type: "RICH_TEXT", content: { text: "x" } }), false);
  assert.equal(ok({ type: "HTML", content: { html: "<b>x</b>" } }), false);
});

test("an image must have a description", () => {
  assert.equal(ok({ type: "IMAGE", content: { path: "site/abc.webp", alt: "", align: "left" } }), false);
  assert.equal(ok({ type: "IMAGE", content: { path: "site/abc.webp", alt: "   ", align: "left" } }), false);
});

test("an image path cannot point outside the site's own storage folder", () => {
  assert.equal(ok({ type: "IMAGE", content: { path: "https://evil.example/x.png", alt: "x", align: "left" } }), false);
  assert.equal(ok({ type: "IMAGE", content: { path: "../secrets/x.webp", alt: "x", align: "left" } }), false);
});

test("links allow only http, https, tel and mailto, or another page of the site", () => {
  const button = (link: unknown) => ok({ type: "BUTTON", content: { label: "Go", link, align: "left" } });
  assert.ok(button({ kind: "url", url: "https://example.org/give" }));
  assert.ok(button({ kind: "url", url: "http://example.org" }));
  assert.ok(button({ kind: "url", url: "tel:+639000000000" }));
  assert.ok(button({ kind: "url", url: "mailto:office@example.org" }));
  assert.ok(button({ kind: "page", slug: "about-us" }));
  assert.equal(button({ kind: "url", url: "javascript:alert(1)" }), false);
  assert.equal(button({ kind: "url", url: "data:text/html,<script>alert(1)</script>" }), false);
  assert.equal(button({ kind: "url", url: "//evil.example" }), false);
  assert.equal(button({ kind: "page", slug: "../admin" }), false);
});

test("text styling is a small allowed set, and links inside text follow the same rule", () => {
  const paragraph = (runs: unknown) => ok({ type: "PARAGRAPH", content: { runs, align: "left", size: "normal" } });
  assert.ok(paragraph([{ text: "a", bold: true, italic: true }, { text: "b", link: { kind: "url", url: "https://example.org" } }]));
  assert.equal(paragraph([{ text: "a", link: { kind: "url", url: "javascript:alert(1)" } }]), false);
  assert.equal(paragraph([{ text: "a", html: "<b>" }]), false, "no raw HTML field is accepted");
  assert.equal(paragraph([{ text: "a", color: "red" }]), false, "no per-block colours");
});

test("options are limited to left or centre alignment and normal or large text", () => {
  assert.equal(ok({ type: "PARAGRAPH", content: { runs: [{ text: "a" }], align: "right", size: "normal" } }), false);
  assert.equal(ok({ type: "PARAGRAPH", content: { runs: [{ text: "a" }], align: "left", size: "huge" } }), false);
});

test("a page is bounded: 60 blocks, 20 pages, and a title that makes an address", () => {
  const block = { type: "SPACER", content: { size: "small" } };
  const page = (blocks: unknown[]) => PageInputSchema.safeParse({ title: "Visit", blocks }).success;
  assert.equal(SITE_LIMITS.blocksPerPage, 60);
  assert.equal(SITE_LIMITS.pagesPerChurch, 20);
  assert.ok(page(Array.from({ length: 60 }, () => block)));
  assert.equal(page(Array.from({ length: 61 }, () => block)), false);
  assert.equal(PageInputSchema.safeParse({ title: "   ", blocks: [] }).success, false);
});

test("a page address comes from its title", () => {
  assert.equal(pageSlugFromTitle("Plan Your Visit"), "plan-your-visit");
  assert.equal(pageSlugFromTitle("  Who we are!  "), "who-we-are");
  assert.equal(pageSlugFromTitle("Niño's Café"), "nino-s-cafe");
  assert.equal(pageSlugFromTitle("???"), "page");
});
