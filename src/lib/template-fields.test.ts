import assert from "node:assert/strict";
import {
  normalizeTemplateFieldDefinition,
  validateTemplateFieldValues,
} from "./template-fields.ts";

export function runTemplateFieldTests() {
  const definition = normalizeTemplateFieldDefinition({
    fields: [
      { key: "speaker", label: "Speaker", type: "person", required: true, order: 5 },
      { key: "notes", label: "Notes", type: "long_text", required: false, order: 1 },
    ],
  });

  assert.deepEqual(definition.fields.map((field) => field.order), [0, 1]);
  assert.equal(validateTemplateFieldValues(definition, {}, { requireRequired: false }).valid, true);
  assert.deepEqual(validateTemplateFieldValues(definition, {}, { requireRequired: true }).missingRequiredFields, ["speaker"]);
  assert.deepEqual(validateTemplateFieldValues(definition, { unknown: "no" }, { requireRequired: false }).invalidKeys, ["unknown"]);
}
