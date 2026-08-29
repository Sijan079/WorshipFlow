import { normalizeTemplateFieldDefinition, validateTemplateFieldValues } from "./template-fields.ts";

type ServiceBlockForReadiness = {
  label: string | null;
  fieldDefinition: unknown;
  fieldValues: unknown;
};

export function getMissingServiceFields(blocks: ServiceBlockForReadiness[]) {
  return blocks.flatMap((block) => {
    const definition = normalizeTemplateFieldDefinition(
      (block.fieldDefinition ?? { fields: [] }) as Parameters<typeof normalizeTemplateFieldDefinition>[0],
    );
    const values = block.fieldValues && typeof block.fieldValues === "object" && !Array.isArray(block.fieldValues)
      ? block.fieldValues as Record<string, unknown>
      : {};
    const missing = validateTemplateFieldValues(definition, values, { requireRequired: true }).missingRequiredFields;
    return missing.map((fieldKey) => ({
      blockLabel: block.label || "Program block",
      fieldLabel: definition.fields.find((field) => field.key === fieldKey)?.label ?? fieldKey,
      fieldKey,
    }));
  });
}
