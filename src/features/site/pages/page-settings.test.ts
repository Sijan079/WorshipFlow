import assert from "node:assert/strict";
import { test } from "node:test";
import { decidePageUpdate, hasMainHeading, planHomeSwap } from "./page-rules.ts";
import { CreatePageSchema, UpdatePageSchema } from "./page-validation.ts";

const live = { status: "PUBLISHED" as const, isPublic: true };

test("showing or hiding the page title is a change to the page itself, like its words", () => {
  assert.deepEqual(decidePageUpdate({ existing: live, input: { showTitle: false }, canPublish: false }), { ok: true, status: "DRAFT", sentBackToDraft: true });
  assert.deepEqual(decidePageUpdate({ existing: live, input: { showTitle: false }, canPublish: true }), { ok: true, status: undefined, sentBackToDraft: false });
});

test("a page's title switch is a plain true or false, and is optional", () => {
  assert.ok(UpdatePageSchema.safeParse({ showTitle: false }).success);
  assert.ok(UpdatePageSchema.safeParse({ showTitle: true }).success);
  assert.equal(UpdatePageSchema.safeParse({ showTitle: "no" }).success, false);
  assert.ok(CreatePageSchema.safeParse({ title: "Home", showTitle: false }).success);
  assert.ok(CreatePageSchema.safeParse({ title: "Home" }).success);
});

test("a page needs one main heading: its title, or the headline of a Cover when the title is hidden", () => {
  const cover = { type: "COVER" as const };
  const text = { type: "PARAGRAPH" as const };
  assert.equal(hasMainHeading({ showTitle: true, blocks: [text] }), true);
  assert.equal(hasMainHeading({ showTitle: false, blocks: [text] }), false);
  assert.equal(hasMainHeading({ showTitle: false, blocks: [text, cover] }), true);
  assert.equal(hasMainHeading({ showTitle: false, blocks: [] }), false);
});

const pages = [
  { id: "old", title: "Welcome", slug: "home" },
  { id: "visit", title: "Plan Your Visit", slug: "plan-your-visit" },
  { id: "new", title: "Homepage (new)", slug: "homepage-new" },
];

test("making a page the home page gives the old home page an address from its title", () => {
  const plan = planHomeSwap({ pages, targetId: "new" });
  assert.deepEqual(plan, { ok: true, oldHome: { id: "old", newSlug: "welcome" } });
});

test("the old home page's new address avoids the ones in use, and the one the new home page leaves behind is free", () => {
  const busy = [...pages, { id: "x", title: "Other", slug: "welcome" }];
  assert.deepEqual(planHomeSwap({ pages: busy, targetId: "new" }), { ok: true, oldHome: { id: "old", newSlug: "welcome-2" } });
  const freed = [{ id: "old", title: "Welcome", slug: "home" }, { id: "new", title: "Welcome", slug: "welcome" }];
  assert.deepEqual(planHomeSwap({ pages: freed, targetId: "new" }), { ok: true, oldHome: { id: "old", newSlug: "welcome" } }, "the new home page's old address is free once it becomes home");
});

test("the page that is already the home page cannot be made the home page again, and an unknown page is refused", () => {
  assert.equal(planHomeSwap({ pages, targetId: "old" }).ok, false);
  assert.equal(planHomeSwap({ pages, targetId: "missing" }).ok, false);
});

test("a church with no home page yet just gets one", () => {
  const withoutHome = [{ id: "visit", title: "Plan Your Visit", slug: "plan-your-visit" }];
  assert.deepEqual(planHomeSwap({ pages: withoutHome, targetId: "visit" }), { ok: true, oldHome: null });
});
