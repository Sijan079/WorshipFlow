import { z } from "zod";

const label = z.string().trim().min(1, "Ministry name is required.").max(60, "Ministry name is too long.");

export const CreateMinistrySchema = z.object({ label });

export const UpdateMinistrySchema = z
  .object({
    label,
    active: z.boolean(),
    leaderId: z.uuid().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export type CreateMinistryInput = z.infer<typeof CreateMinistrySchema>;
export type UpdateMinistryInput = z.infer<typeof UpdateMinistrySchema>;

// Codes identify a ministry inside a workspace. They are generated from the name,
// so nobody has to type one.
export function ministryCodeFromLabel(text: string, existingCodes: readonly string[]) {
  const base =
    text
      .toUpperCase()
      .replace(/['’]/g, "")
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "MINISTRY";
  if (!existingCodes.includes(base)) return base;
  let suffix = 2;
  while (existingCodes.includes(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
