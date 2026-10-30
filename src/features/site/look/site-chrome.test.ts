import assert from "node:assert/strict";
import { test } from "node:test";
import { footerServiceTimes, headerButton, pageHref } from "./site-chrome.ts";

test("a page address is the church's main address for the home page, and a sub-address for any other", () => {
  assert.equal(pageHref("grace", "home"), "/c/grace");
  assert.equal(pageHref("grace", "plan-your-visit"), "/c/grace/plan-your-visit");
});

test("the header button needs both its words and a page; without either there is no button", () => {
  assert.deepEqual(headerButton({ label: "Plan your visit", slug: "plan-your-visit" }, "grace"), { label: "Plan your visit", href: "/c/grace/plan-your-visit" });
  assert.deepEqual(headerButton({ label: "  Visit us  ", slug: "home" }, "grace"), { label: "Visit us", href: "/c/grace" });
  assert.equal(headerButton({ label: "", slug: "plan-your-visit" }, "grace"), null);
  assert.equal(headerButton({ label: "Plan your visit", slug: null }, "grace"), null);
  assert.equal(headerButton({ label: null, slug: null }, "grace"), null);
});

test("the header button never points at a page that is not in the menu", () => {
  const menu = [{ slug: "home", title: "Home" }, { slug: "plan-your-visit", title: "Plan your visit" }];
  assert.ok(headerButton({ label: "Go", slug: "plan-your-visit" }, "grace", menu));
  assert.equal(headerButton({ label: "Go", slug: "secret-draft" }, "grace", menu), null, "an unpublished page is not linked from the header");
});

test("the footer's service times are one per line, trimmed, with blank lines dropped, and at most ten", () => {
  assert.deepEqual(footerServiceTimes("Sunday 9:00 AM\n\n  Wednesday 7:00 PM  \n"), ["Sunday 9:00 AM", "Wednesday 7:00 PM"]);
  assert.deepEqual(footerServiceTimes(null), []);
  assert.deepEqual(footerServiceTimes(""), []);
  assert.equal(footerServiceTimes(Array.from({ length: 15 }, (_, i) => `Line ${i}`).join("\n")).length, 10);
});
