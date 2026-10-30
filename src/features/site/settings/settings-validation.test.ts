import assert from "node:assert/strict";
import { test } from "node:test";
import { decideSettingsUpdate } from "./settings-rules.ts";
import { UpdateSiteSettingsSchema } from "./settings-validation.ts";

const parse = (value: unknown) => UpdateSiteSettingsSchema.safeParse(value);

test("contact details accept plain values and empty means removed", () => {
  const result = parse({ contactEmail: "office@example.org", contactPhone: "+63 900 000 0000", address: "123 Example Street\nAngeles City" });
  assert.ok(result.success);
  const cleared = parse({ contactEmail: "", contactPhone: "", address: "" });
  assert.ok(cleared.success);
  if (cleared.success) assert.deepEqual(cleared.data, { contactEmail: null, contactPhone: null, address: null });
});

test("an email must look like an email, and unknown fields are refused", () => {
  assert.equal(parse({ contactEmail: "not an email" }).success, false);
  assert.equal(parse({ html: "<b>x</b>" }).success, false);
});

test("lengths are limited", () => {
  assert.equal(parse({ contactPhone: "1".repeat(41) }).success, false);
  assert.equal(parse({ address: "a".repeat(301) }).success, false);
});

test("changing whether search engines may list the site needs Publish", () => {
  assert.equal(decideSettingsUpdate({ existing: { indexable: false }, input: { indexable: true }, canPublish: false }).ok, false);
  assert.equal(decideSettingsUpdate({ existing: { indexable: false }, input: { indexable: true }, canPublish: true }).ok, true);
});

test("editing contact details needs only Edit, and sending the same switch value is not a change", () => {
  assert.equal(decideSettingsUpdate({ existing: { indexable: false }, input: { contactEmail: "a@b.org" }, canPublish: false }).ok, true);
  assert.equal(decideSettingsUpdate({ existing: { indexable: true }, input: { indexable: true, address: "x" }, canPublish: false }).ok, true);
});
