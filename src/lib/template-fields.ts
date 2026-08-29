import {
  normalizeProgramBlockDefinition,
  type ProgramBlockDefinition,
  validateProgramBlockDefaults,
  validateProgramBlockValues,
} from "./program-block-types.ts";

/**
 * A template owns the definition for the fields displayed within each of its
 * ordered blocks. The legacy program-block type catalog uses the same safe,
 * intentionally small field vocabulary, so its definition shape is reused.
 */
export type TemplateFieldDefinition = ProgramBlockDefinition;

export function normalizeTemplateFieldDefinition(input: TemplateFieldDefinition) {
  return normalizeProgramBlockDefinition(input);
}

export function validateTemplateFieldValues(
  definition: TemplateFieldDefinition,
  values: Record<string, unknown>,
  options: { requireRequired: boolean },
) {
  const defaults = validateProgramBlockDefaults(definition, values);
  const required = options.requireRequired
    ? validateProgramBlockValues(definition, values)
    : { valid: true, missingRequiredFields: [] as string[] };

  return {
    valid: defaults.valid && required.valid,
    missingRequiredFields: required.missingRequiredFields,
    invalidKeys: defaults.invalidKeys,
    invalidValues: defaults.invalidValues,
  };
}
