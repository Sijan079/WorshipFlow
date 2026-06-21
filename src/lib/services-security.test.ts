import assert from "node:assert/strict";
import { getErrorMessage } from "./errors.ts";
import { serviceListInclude } from "./service-data.ts";

export function runServicesSecurityTests() {
  assert.equal(getErrorMessage(new Error("database host leaked"), "Fallback"), "Fallback");
  assert.equal(getErrorMessage(new Error("database host leaked"), "Fallback", { exposeInternal: true }), "database host leaked");

  assert.equal("blocks" in serviceListInclude, false);
  assert.equal("jobs" in serviceListInclude, false);
  assert.equal("outputs" in serviceListInclude, false);
  assert.equal("details" in serviceListInclude, false);
  assert.equal("bibleVerses" in serviceListInclude, true);
  assert.equal("servantAssignments" in serviceListInclude, true);
  assert.equal("hymnals" in serviceListInclude, true);
}
