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

test("people access is configurable for view, create, and edit but never delete", () => {
  assert.equal(isConfigurableModuleAction("PEOPLE", "VIEW"), true);
  assert.equal(isConfigurableModuleAction("PEOPLE", "CREATE"), true);
  assert.equal(isConfigurableModuleAction("PEOPLE", "EDIT"), true);
  assert.equal(isConfigurableModuleAction("PEOPLE", "DELETE"), false);
  assert.equal(canShowModuleNavigation("/people", true, true, false), false);
  assert.equal(canShowModuleNavigation("/people", false, false, true), true);
  assert.equal(canShowModuleNavigation("/ministries", false, false, false), false);
});

test("only implemented actions can be assigned", () => {
  assert.equal(isConfigurableModuleAction("EVENTS", "VIEW"), true);
  assert.equal(isConfigurableModuleAction("EVENTS", "CREATE"), true);
  assert.equal(isConfigurableModuleAction("EVENTS", "DELETE"), true);
  assert.equal(isConfigurableModuleAction("EVENTS", "PUBLISH"), false);
  assert.equal(isConfigurableModuleAction("ANNOUNCEMENTS", "PUBLISH"), true);
  assert.equal(isConfigurableModuleAction("ANNOUNCEMENTS", "OPERATE"), false);
  assert.equal(isConfigurableModuleAction("CAPTIONS", "VIEW"), true);
  assert.equal(isConfigurableModuleAction("CAPTIONS", "OPERATE"), true);
  assert.equal(isConfigurableModuleAction("CAPTIONS", "DELETE"), false);
});

test("the Site permissions can be assigned: view, create, edit, delete and publish", () => {
  for (const action of ["VIEW", "CREATE", "EDIT", "DELETE", "PUBLISH"]) assert.equal(isConfigurableModuleAction("SITE", action), true, action);
  assert.equal(isConfigurableModuleAction("SITE", "OPERATE"), false);
});
