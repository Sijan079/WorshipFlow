import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveModuleAction, isConfigurableModuleAction, canShowModuleNavigation } from "./module-access.ts";

test("role defaults and individual exceptions resolve one module action", () => {
  assert.equal(resolveModuleAction("ADMIN", false, false), true);
  assert.equal(resolveModuleAction("OWNER", false, false), true);
  assert.equal(resolveModuleAction("MEMBER", false, null), false);
  assert.equal(resolveModuleAction("MEMBER", true, null), true);
  assert.equal(resolveModuleAction("MEMBER", true, false), false);
  assert.equal(resolveModuleAction("MEMBER", false, true), true);
});

test("module navigation follows resolved view permission", () => {
  assert.equal(canShowModuleNavigation("/events", false), false);
  assert.equal(canShowModuleNavigation("/events", true), true);
  assert.equal(canShowModuleNavigation("/captions", true, false), false);
  assert.equal(canShowModuleNavigation("/captions", true, true), true);
  assert.equal(canShowModuleNavigation("/services", false, false), true);
});

test("only implemented actions can be assigned", () => {
  assert.equal(isConfigurableModuleAction("EVENTS", "VIEW"), true);
  assert.equal(isConfigurableModuleAction("EVENTS", "CREATE"), true);
  assert.equal(isConfigurableModuleAction("EVENTS", "PUBLISH"), false);
  assert.equal(isConfigurableModuleAction("ANNOUNCEMENTS", "PUBLISH"), false);
  assert.equal(isConfigurableModuleAction("CAPTIONS", "VIEW"), true);
  assert.equal(isConfigurableModuleAction("CAPTIONS", "OPERATE"), true);
  assert.equal(isConfigurableModuleAction("CAPTIONS", "DELETE"), false);
});
