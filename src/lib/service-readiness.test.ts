import assert from "node:assert/strict";
import { getMissingServiceFields } from "./service-readiness.ts";

export function runServiceReadinessTests() {
  assert.deepEqual(
    getMissingServiceFields([
      { label: "Message", fieldDefinition: { fields: [{ key: "speaker", label: "Speaker", type: "person", required: true, order: 0 }] }, fieldValues: {} },
      { label: "Offering", fieldDefinition: { fields: [{ key: "note", label: "Note", type: "short_text", required: false, order: 0 }] }, fieldValues: {} },
    ]),
    [{ blockLabel: "Message", fieldLabel: "Speaker", fieldKey: "speaker" }],
  );
}
