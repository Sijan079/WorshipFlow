import assert from "node:assert/strict";
import {
  ProgramBlockDefinitionSchema,
  normalizeProgramBlockDefinition,
  validateProgramBlockValues,
  validateProgramBlockDefaults,
  mapProgramTypeKeyToBlockType,
  getProgramBlockTypeDeleteError,
} from "./program-block-types.ts";

export function runProgramBlockTypeTests() {
  const definition = normalizeProgramBlockDefinition({
    fields: [
      { key: "notes", label: "Notes", type: "long_text", required: false, order: 8 },
      { key: "mode", label: "Mode", type: "single_select", required: true, order: 2, options: ["Prayer", "Response"] },
    ],
  });

  assert.deepEqual(definition.fields.map((field) => field.order), [0, 1]);
  assert.equal(ProgramBlockDefinitionSchema.safeParse(definition).success, true);
  assert.equal(validateProgramBlockValues(definition, {}).valid, false);
  assert.equal(validateProgramBlockValues(definition, { mode: "Prayer", notes: "Ready" }).valid, true);
  assert.equal(validateProgramBlockDefaults(definition, { mode: "Prayer" }).valid, true);
  assert.equal(validateProgramBlockDefaults(definition, { unknown: "value" }).valid, false);
  assert.equal(mapProgramTypeKeyToBlockType("PRAYER_CIRCLE"), "CUSTOM");
  assert.equal(mapProgramTypeKeyToBlockType("SERMON"), "SERMON");
  assert.equal(getProgramBlockTypeDeleteError({ templateBlockCount: 0, serviceBlockCount: 0 }), null);
  assert.match(getProgramBlockTypeDeleteError({ templateBlockCount: 1, serviceBlockCount: 0 }) ?? "", /template/);
  assert.equal(
    ProgramBlockDefinitionSchema.safeParse({ fields: [{ key: "mode", label: "Mode", type: "single_select" }] }).success,
    false,
  );
}
