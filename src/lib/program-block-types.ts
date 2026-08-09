import { z } from "zod";
import { PresetCodeSchema } from "./settings-presets.ts";
import { BlockTypeValues } from "./service-constants.ts";

export const PROGRAM_BLOCK_FIELD_TYPES = [
  "short_text",
  "long_text",
  "person",
  "song",
  "scripture_reference",
  "media",
  "duration",
  "checkbox",
  "single_select",
] as const;

export const ProgramBlockFieldTypeSchema = z.enum(PROGRAM_BLOCK_FIELD_TYPES);

const ProgramBlockFieldSchema = z.object({
  key: z.string().trim().min(1).max(48).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(1).max(80),
  type: ProgramBlockFieldTypeSchema,
  required: z.boolean().default(false),
  order: z.number().int().min(0),
  options: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  helpText: z.string().trim().max(160).optional(),
});

export const ProgramBlockDefinitionSchema = z.object({
  fields: z.array(ProgramBlockFieldSchema).max(30),
}).superRefine((definition, context) => {
  const keys = definition.fields.map((field) => field.key);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", path: ["fields"], message: "Field keys must be unique" });
  }

  definition.fields.forEach((field, index) => {
    if (field.type === "single_select" && (!field.options || field.options.length === 0)) {
      context.addIssue({ code: "custom", path: ["fields", index, "options"], message: "Select fields require options" });
    }
  });
});

export type ProgramBlockDefinition = z.infer<typeof ProgramBlockDefinitionSchema>;

export const ProgramBlockTypePayloadSchema = z.object({
  key: PresetCodeSchema,
  label: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  definition: ProgramBlockDefinitionSchema,
});

export const ProgramBlockVersionPayloadSchema = z.object({
  definition: ProgramBlockDefinitionSchema,
});

export const ProgramBlockValuesPayloadSchema = z.object({
  values: z.record(z.string(), z.unknown()),
});

export function normalizeProgramBlockDefinition(input: z.input<typeof ProgramBlockDefinitionSchema>) {
  const parsed = ProgramBlockDefinitionSchema.parse({
    fields: input.fields.map((field, order) => ({ ...field, order })),
  });
  return {
    ...parsed,
    fields: parsed.fields.map((field, order) => ({ ...field, order })),
  } satisfies ProgramBlockDefinition;
}

export function validateProgramBlockValues(definition: ProgramBlockDefinition, values: Record<string, unknown>) {
  const missingRequiredFields = definition.fields
    .filter((field) => field.required && (values[field.key] === undefined || values[field.key] === null || values[field.key] === ""))
    .map((field) => field.key);

  return {
    valid: missingRequiredFields.length === 0,
    missingRequiredFields,
  };
}

export function validateProgramBlockDefaults(definition: ProgramBlockDefinition, values: Record<string, unknown>) {
  const fields = new Map(definition.fields.map((field) => [field.key, field]));
  const invalidKeys = Object.keys(values).filter((key) => !fields.has(key));
  const invalidValues = Object.entries(values).flatMap(([key, value]) => {
    const field = fields.get(key);
    if (!field || value === null || value === undefined || value === "") return [];
    if (field.type === "checkbox" && typeof value !== "boolean") return [key];
    if (field.type === "duration" && typeof value !== "number") return [key];
    if (field.type === "single_select" && (!field.options || !field.options.includes(String(value)))) return [key];
    return [];
  });
  return { valid: invalidKeys.length === 0 && invalidValues.length === 0, invalidKeys, invalidValues };
}

export function mapProgramTypeKeyToBlockType(key: string) {
  return key === "PROGRAM_ITEM" || !BlockTypeValues.includes(key as (typeof BlockTypeValues)[number]) ? "CUSTOM" : key;
}

export function getProgramBlockTypeDeleteError(counts: { templateBlockCount: number; serviceBlockCount: number }) {
  if (counts.serviceBlockCount > 0) return "This block type is used by existing services. Replace those blocks before deleting it.";
  if (counts.templateBlockCount > 0) return "This block type is used by service templates. Remove it from those templates before deleting it.";
  return null;
}
