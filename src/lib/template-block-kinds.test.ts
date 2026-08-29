import assert from "node:assert/strict";
import {
  TemplateBlockKindSchema,
  getEmptyBlockValues,
  validateTemplateBlockValues,
} from "./template-block-kinds.ts";

export function runTemplateBlockKindTests() {
  assert.equal(TemplateBlockKindSchema.parse("TEXT"), "TEXT");
  assert.equal(TemplateBlockKindSchema.parse("PERSON"), "PERSON");
  assert.equal(TemplateBlockKindSchema.safeParse("SONG").success, false);
  assert.deepEqual(getEmptyBlockValues("TEXT"), { text: "" });
  assert.deepEqual(getEmptyBlockValues("PERSON"), { personIds: [] });
  assert.deepEqual(validateTemplateBlockValues("TEXT", { text: "Service notes" }), { valid: true, values: { text: "Service notes" } });
  assert.deepEqual(validateTemplateBlockValues("PERSON", { personIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000001"] }), { valid: true, values: { personIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"] } });
  assert.equal(validateTemplateBlockValues("TEXT", { personIds: [] }).valid, false);
  assert.equal(validateTemplateBlockValues("PERSON", { text: "Speaker" }).valid, false);
}
