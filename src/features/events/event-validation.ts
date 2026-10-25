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

const registrationUrl = z.url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Use an HTTP or HTTPS link.").optional();

function dateInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export const CreateEventSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  venue: z.string().trim().max(200).optional(),
  localDate,
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  timezone,
  registrationUrl,
}).superRefine((value, context) => {
  const startsAt = new Date(value.startsAt);
  const endsAt = new Date(value.endsAt);
  if (endsAt <= startsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after start time." });
  }
  if (dateInTimezone(startsAt, value.timezone) !== value.localDate) {
    context.addIssue({ code: "custom", path: ["localDate"], message: "Date must match the event time zone." });
  }
});

export const EventRangeSchema = z.object({ from: localDate, to: localDate }).refine(
  (value) => value.from <= value.to && (Date.parse(value.to) - Date.parse(value.from)) <= 93 * 86400000,
  "Select a range of up to 93 days.",
);
