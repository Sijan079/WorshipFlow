import assert from "node:assert/strict";
import { getErrorMessage } from "./errors.ts";
import { serviceListRelations } from "./service-data.ts";

export function runServicesSecurityTests() {
  assert.equal(getErrorMessage(new Error("database host leaked"), "Fallback"), "Fallback");
  assert.equal(getErrorMessage(new Error("database host leaked"), "Fallback", { exposeInternal: true }), "database host leaked");

  assert.equal("blocks" in serviceListRelations.include, false);
  assert.equal("jobs" in serviceListRelations.include, false);
  assert.equal("outputs" in serviceListRelations.include, false);
  assert.equal("details" in serviceListRelations.include, false);
  assert.equal("bibleVerses" in serviceListRelations.include, true);
  assert.equal("servantAssignments" in serviceListRelations.include, true);
  assert.equal("hymnals" in serviceListRelations.include, true);
}
