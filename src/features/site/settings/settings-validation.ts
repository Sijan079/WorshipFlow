import { z } from "zod";
import { COLOR_SET_IDS, FONT_STYLE_IDS } from "../look/look.ts";

// An empty field means "remove it", so it is stored as nothing rather than as an empty string.
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => (value === "" ? null : value));

const SERVICE_TIME_LINES = 10;
const SERVICE_TIME_LINE_MAX = 120;

// Service times are typed one per line. They are tidied (trimmed, blank lines dropped) and stored as plain text.
const serviceTimes = z
  .string()
  .max(SERVICE_TIME_LINES * (SERVICE_TIME_LINE_MAX + 1))
  .transform((value) => value.split("\n").map((line) => line.trim()).filter((line) => line !== ""))
  .refine((lines) => lines.length <= SERVICE_TIME_LINES, `Use at most ${SERVICE_TIME_LINES} lines.`)
  .refine((lines) => lines.every((line) => line.length <= SERVICE_TIME_LINE_MAX), `Keep each line under ${SERVICE_TIME_LINE_MAX} characters.`)
  .transform((lines) => (lines.length === 0 ? null : lines.join("\n")));

export const UpdateSiteSettingsSchema = z.strictObject({
  contactEmail: optionalText(160).refine((value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter an email address like office@example.org.").optional(),
  contactPhone: optionalText(40).optional(),
  address: optionalText(300).optional(),
  // Whether search engines may list the site. Changing it needs the Publish permission.
  indexable: z.boolean().optional(),
  // The look: one of the offered colour sets and font styles, never a free colour.
  colorSet: z.enum(COLOR_SET_IDS).optional(),
  fontStyle: z.enum(FONT_STYLE_IDS).optional(),
  // The logo is one of the church's own pictures (checked again on save), or nothing.
  logoPath: z.string().regex(/^site\/[A-Za-z0-9_-]+\.webp$/).nullable().optional(),
  // The header's call-to-action button: its words and the page it opens. Empty means no button.
  headerButtonLabel: optionalText(40).optional(),
  headerButtonSlug: z.string().trim().regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/).max(80).transform((value) => (value === "" ? null : value)).optional(),
  serviceTimes: serviceTimes.optional(),
});

export type UpdateSiteSettingsInput = z.infer<typeof UpdateSiteSettingsSchema>;
