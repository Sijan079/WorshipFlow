import assert from "node:assert/strict";
import { test } from "node:test";
import { PageInputSchema } from "../blocks/block-validation.ts";
import { STARTER_HOME_BLOCKS, STARTER_HOME_TITLE } from "./starter-home.ts";

test("the starter home page follows the same rules as any page", () => {
  const parsed = PageInputSchema.safeParse({ title: STARTER_HOME_TITLE, blocks: STARTER_HOME_BLOCKS });
  assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues));
});

test("the starter home page shows service times, announcements, events and contact", () => {
  const types = STARTER_HOME_BLOCKS.map((block) => block.type);
  for (const type of ["SERVICE_TIMES", "ANNOUNCEMENTS_LIST", "EVENTS_LIST", "CONTACT"]) assert.ok(types.includes(type as never), type);
});
