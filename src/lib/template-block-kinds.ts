import { z } from "zod";

export const TEMPLATE_BLOCK_KINDS = ["PERSON", "TEXT"] as const;
export const TemplateBlockKindSchema = z.enum(TEMPLATE_BLOCK_KINDS);
export type TemplateBlockKind = z.infer<typeof TemplateBlockKindSchema>;

const TextValuesSchema = z.object({ text: z.string().max(10_000) }).strict();
const PersonValuesSchema = z.object({ personIds: z.array(z.string().uuid()).max(50) }).strict();

export function getEmptyBlockValues(kind: TemplateBlockKind) {
  return kind === "PERSON" ? { personIds: [] } : { text: "" };
}

export function validateTemplateBlockValues(kind: TemplateBlockKind, input: unknown) {
  const parsed = (kind === "PERSON" ? PersonValuesSchema : TextValuesSchema).safeParse(input);
  if (!parsed.success) return { valid: false as const, error: parsed.error.format() };

  if (kind === "PERSON") {
    const values = parsed.data as z.infer<typeof PersonValuesSchema>;
    return { valid: true as const, values: { personIds: [...new Set(values.personIds)] } };
  }

  const values = parsed.data as z.infer<typeof TextValuesSchema>;
  return { valid: true as const, values: { text: values.text } };
}
