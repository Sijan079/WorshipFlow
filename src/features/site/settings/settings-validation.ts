import { z } from "zod";

// An empty field means "remove it", so it is stored as nothing rather than as an empty string.
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => (value === "" ? null : value));

export const UpdateSiteSettingsSchema = z.strictObject({
  contactEmail: optionalText(160).refine((value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter an email address like office@example.org.").optional(),
  contactPhone: optionalText(40).optional(),
  address: optionalText(300).optional(),
  // Whether search engines may list the site. Changing it needs the Publish permission.
  indexable: z.boolean().optional(),
});

export type UpdateSiteSettingsInput = z.infer<typeof UpdateSiteSettingsSchema>;
