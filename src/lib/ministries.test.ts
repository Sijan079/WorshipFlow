import assert from "node:assert/strict";
import { DEFAULT_MINISTRIES, ministryCodeFromLegacy } from "./ministries.ts";

export function runMinistriesTests() {
  assert.deepEqual(
    DEFAULT_MINISTRIES.map((ministry) => ministry.code),
    ["CHURCH_LEADERS", "PASTORS", "MENS", "LADIES", "YOUTH", "TECH", "MUSIC", "MIXED"],
  );
  assert.equal(new Set(DEFAULT_MINISTRIES.map((ministry) => ministry.code)).size, DEFAULT_MINISTRIES.length);

  // Mixed is how a service is run (a mixed team on a 5th Sunday), not a group people belong to.
  const serviceOnly = DEFAULT_MINISTRIES.filter((ministry) => ministry.serviceOnly).map((ministry) => ministry.code);
  assert.deepEqual(serviceOnly, ["MIXED"]);

  const labels = Object.fromEntries(DEFAULT_MINISTRIES.map((ministry) => [ministry.code, ministry.label]));
  assert.equal(labels.CHURCH_LEADERS, "Church Leaders");
  assert.equal(labels.MENS, "Men's");
  assert.equal(labels.LADIES, "Ladies'");

  // Service ministries and servant groups used different codes for the same group of people.
  assert.equal(ministryCodeFromLegacy("LEADERS"), "CHURCH_LEADERS");
  assert.equal(ministryCodeFromLegacy("CHURCH_LEADERS"), "CHURCH_LEADERS");
  assert.equal(ministryCodeFromLegacy("MENS"), "MENS");
  assert.equal(ministryCodeFromLegacy("MIXED"), "MIXED");
  assert.equal(ministryCodeFromLegacy("UNKNOWN_CUSTOM"), "UNKNOWN_CUSTOM");
}
