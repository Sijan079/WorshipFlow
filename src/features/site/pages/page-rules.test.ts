import assert from "node:assert/strict";
import { test } from "node:test";
import { canAddPage, canDeletePage, decidePageUpdate, menuPages, nextSortOrder, uniquePageSlug } from "./page-rules.ts";

const draft = { status: "DRAFT" as const, isPublic: false };
const live = { status: "PUBLISHED" as const, isPublic: true };

test("someone who can publish may change anything about a page", () => {
  assert.deepEqual(decidePageUpdate({ existing: live, input: { status: "DRAFT", blocks: [] }, canPublish: true }), { ok: true, status: undefined, sentBackToDraft: false });
});

test("someone who cannot publish cannot publish, unpublish or flip the public switch", () => {
  for (const input of [{ status: "PUBLISHED" as const }, { isPublic: true }]) {
    const result = decidePageUpdate({ existing: draft, input, canPublish: false });
    assert.equal(result.ok, false);
  }
  assert.equal(decidePageUpdate({ existing: live, input: { status: "DRAFT" }, canPublish: false }).ok, false);
});

test("editing a live page without Publish sends it back to Draft", () => {
  for (const input of [{ title: "New" }, { description: "x" }, { blocks: [] }]) {
    assert.deepEqual(decidePageUpdate({ existing: live, input, canPublish: false }), { ok: true, status: "DRAFT", sentBackToDraft: true });
  }
});

test("editing a draft without Publish just saves it", () => {
  assert.deepEqual(decidePageUpdate({ existing: draft, input: { blocks: [] }, canPublish: false }), { ok: true, status: undefined, sentBackToDraft: false });
});

test("only a draft can be deleted, and the home page never can", () => {
  assert.equal(canDeletePage({ slug: "visit", status: "DRAFT" }), true);
  assert.equal(canDeletePage({ slug: "visit", status: "PUBLISHED" }), false);
  assert.equal(canDeletePage({ slug: "home", status: "DRAFT" }), false);
});

test("a church can have at most 20 pages", () => {
  assert.equal(canAddPage(19), true);
  assert.equal(canAddPage(20), false);
});

test("a new page gets a free address, and 'home' belongs to the home page", () => {
  assert.equal(uniquePageSlug("Plan Your Visit", new Set()), "plan-your-visit");
  assert.equal(uniquePageSlug("Plan Your Visit", new Set(["plan-your-visit"])), "plan-your-visit-2");
  assert.equal(uniquePageSlug("Plan Your Visit", new Set(["plan-your-visit", "plan-your-visit-2"])), "plan-your-visit-3");
  assert.equal(uniquePageSlug("Home", new Set()), "home-2");
});

test("the menu lists only published, public pages, home first, then in the church's order", () => {
  const pages = [
    { slug: "visit", title: "Visit", status: "PUBLISHED" as const, isPublic: true, sortOrder: 2 },
    { slug: "about", title: "About", status: "PUBLISHED" as const, isPublic: true, sortOrder: 1 },
    { slug: "secret", title: "Secret", status: "DRAFT" as const, isPublic: true, sortOrder: 0 },
    { slug: "hidden", title: "Hidden", status: "PUBLISHED" as const, isPublic: false, sortOrder: 3 },
    { slug: "home", title: "Home", status: "PUBLISHED" as const, isPublic: true, sortOrder: 9 },
  ];
  assert.deepEqual(menuPages(pages).map((page) => page.slug), ["home", "about", "visit"]);
});

test("a new page goes last in the menu", () => {
  assert.equal(nextSortOrder([]), 0);
  assert.equal(nextSortOrder([0, 3, 1]), 4);
});

test("a page cannot take an address the site already uses for something else", () => {
  assert.equal(uniquePageSlug("Image", new Set()), "image-2");
  assert.equal(uniquePageSlug("Images", new Set()), "images");
});
