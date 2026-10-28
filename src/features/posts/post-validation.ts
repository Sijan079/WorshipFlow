import { z } from "zod";

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");

const timezone = z.string().min(1).max(100).refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Enter a valid time zone.");

export const ANNOUNCEMENT_BODY_MAX = 4000;
export const INSTAGRAM_CAPTION_WARNING = 2200;

const title = z.string().trim().min(1, "Enter a title.").max(160);
const body = z.string().max(ANNOUNCEMENT_BODY_MAX);
const social = z.string().max(ANNOUNCEMENT_BODY_MAX);

function datesInOrder(value: { startDate?: string | null; endDate?: string | null }, context: z.RefinementCtx) {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "The end date cannot be before the start date." });
  }
}

// An announcement is validated as an announcement. The schemas are strict, so a field that belongs to another
// kind of post (a slug, an article publish date) is refused, and the kind itself is never chosen by the caller.
// Authorship is not accepted either: it comes from the signed-in user.
export const CreateAnnouncementSchema = z.object({
  title,
  body: body.default(""),
  timezone,
  startDate: localDate.nullable().optional(),
  endDate: localDate.nullable().optional(),
  eventId: z.uuid().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  isPublic: z.boolean().default(false),
  facebookText: social.nullable().optional(),
  instagramText: social.nullable().optional(),
}).strict().superRefine(datesInOrder);

export const UpdateAnnouncementSchema = z.object({
  title: title.optional(),
  body: body.optional(),
  startDate: localDate.nullable().optional(),
  endDate: localDate.nullable().optional(),
  eventId: z.uuid().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  isPublic: z.boolean().optional(),
  facebookText: social.nullable().optional(),
  instagramText: social.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (Object.values(value).every((entry) => entry === undefined)) {
    context.addIssue({ code: "custom", message: "Change at least one thing." });
  }
  datesInOrder(value, context);
});
