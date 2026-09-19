import assert from "node:assert/strict";
import { getErrorMessage } from "./errors.ts";
import { serviceListRelations } from "./service-data.ts";

export function runServicesSecurityTests() {
  const originalConsoleError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    assert.equal(getErrorMessage(new Error("database host leaked"), "Fallback"), "Fallback");
    assert.equal(getErrorMessage(new Error("database host leaked"), "Fallback", { exposeInternal: true }), "database host leaked");
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(logged.length, 2);
  const firstRecord = JSON.parse(String(logged[0]?.[0]));
  assert.equal(firstRecord.event, "route.handler.failure");
  assert.equal(firstRecord.route, "/api/unknown");
  assert.equal(firstRecord.metric.name, "worship_flow_failures_total");

  assert.equal("blocks" in serviceListRelations.include, true);
  assert.equal("jobs" in serviceListRelations.include, false);
  assert.equal("outputs" in serviceListRelations.include, false);
  assert.equal("details" in serviceListRelations.include, false);
  assert.equal("bibleVerses" in serviceListRelations.include, false);
  assert.equal("servantAssignments" in serviceListRelations.include, false);
  assert.equal("hymnals" in serviceListRelations.include, false);
  assert.equal("people" in serviceListRelations.include.blocks.include, true);
  assert.equal("songs" in serviceListRelations.include.blocks.include, true);
  assert.equal("details" in serviceListRelations.include.blocks.include, true);
}
