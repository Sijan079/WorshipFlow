import assert from "node:assert/strict";
import { test } from "node:test";
import { UpdateSiteSettingsSchema } from "./settings-validation.ts";

const parse = (value: unknown) => UpdateSiteSettingsSchema.safeParse(value);
const logo = "site/3f2b8c1e-5d4a-4e7b-9c6a-1b2c3d4e5f60.webp";

test("only the five colour sets and the two font styles can be chosen", () => {
  for (const colorSet of ["dawn", "meadow", "harbor", "clay", "slate"]) assert.ok(parse({ colorSet }).success, colorSet);
  for (const fontStyle of ["clean", "classic"]) assert.ok(parse({ fontStyle }).success, fontStyle);
  assert.equal(parse({ colorSet: "rainbow" }).success, false);
  assert.equal(parse({ colorSet: "#ff0000" }).success, false, "no free colours");
  assert.equal(parse({ fontStyle: "comic" }).success, false);
});

test("the logo is one of the church's own pictures, or nothing", () => {
  assert.ok(parse({ logoPath: logo }).success);
  const cleared = parse({ logoPath: null });
  assert.ok(cleared.success);
  if (cleared.success) assert.equal(cleared.data.logoPath, null);
  assert.equal(parse({ logoPath: "https://evil.example/logo.webp" }).success, false);
  assert.equal(parse({ logoPath: "site/../secret.webp" }).success, false);
});

test("the header button has words of at most 40 characters and a page; empty means no button", () => {
  const result = parse({ headerButtonLabel: "  Plan your visit  ", headerButtonSlug: "plan-your-visit" });
  assert.ok(result.success);
  if (result.success) assert.deepEqual([result.data.headerButtonLabel, result.data.headerButtonSlug], ["Plan your visit", "plan-your-visit"]);
  const empty = parse({ headerButtonLabel: "", headerButtonSlug: "" });
  assert.ok(empty.success);
  if (empty.success) assert.deepEqual([empty.data.headerButtonLabel, empty.data.headerButtonSlug], [null, null]);
  assert.equal(parse({ headerButtonLabel: "x".repeat(41) }).success, false);
  assert.equal(parse({ headerButtonSlug: "../admin" }).success, false);
  assert.equal(parse({ headerButtonSlug: "Has Spaces" }).success, false);
});

test("service times are kept one per line, trimmed, with blank lines dropped, and nothing means none", () => {
  const result = parse({ serviceTimes: "Sunday 9:00 AM\n\n  Wednesday 7:00 PM  \n" });
  assert.ok(result.success);
  if (result.success) assert.equal(result.data.serviceTimes, "Sunday 9:00 AM\nWednesday 7:00 PM");
  const empty = parse({ serviceTimes: "  \n " });
  assert.ok(empty.success);
  if (empty.success) assert.equal(empty.data.serviceTimes, null);
});

test("service times have at most ten lines of at most 120 characters", () => {
  assert.ok(parse({ serviceTimes: Array.from({ length: 10 }, (_, i) => `Line ${i}`).join("\n") }).success);
  assert.equal(parse({ serviceTimes: Array.from({ length: 11 }, (_, i) => `Line ${i}`).join("\n") }).success, false);
  assert.equal(parse({ serviceTimes: "x".repeat(121) }).success, false);
});

test("the look settings accept nothing else: no HTML, no styles", () => {
  assert.equal(parse({ colorSet: "dawn", css: "body{display:none}" }).success, false);
  assert.equal(parse({ headerButtonLabel: "Go", html: "<b>x</b>" }).success, false);
});
