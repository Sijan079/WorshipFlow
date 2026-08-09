import assert from "node:assert/strict";
import { createWorkspaceSlug } from "./workspace-slug.ts";

export function runWorkspaceSlugTests() {
  assert.equal(createWorkspaceSlug("Angeles City Bible Church"), "angeles-city-bible-church");
  assert.equal(createWorkspaceSlug("  Youth & Worship  "), "youth-worship");
  assert.equal(createWorkspaceSlug("!!!"), "workspace");
}
