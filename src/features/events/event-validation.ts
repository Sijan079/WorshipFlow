import { z } from "zod";
import { addDays, eventSpanDays } from "./recurrence.ts";

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

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 09:30.");

// How the event repeats. A bounded series is limited to two years so it never creates an endless pile of rows.
export const RepeatRuleSchema = z.object({
  kind: z.enum(["NONE", "DAILY", "WEEKLY"]),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]).refine((days) => new Set(days).size === days.length, "Choose each day once."),
  until: localDate.nullable().default(null),
}).superRefine((value, context) => {
  if (value.kind === "WEEKLY" && value.weekdays.length === 0) {
    context.addIssue({ code: "custom", path: ["weekdays"], message: "Choose at least one day of the week." });
  }
});

const MAX_SERIES_DAYS = 731;
const MAX_ONE_OFF_SPAN_DAYS = 30;

// The shortest gap in days between two occurrences of the rule, so a multi-day event cannot overlap itself.
export function shortestRepeatGap(rule: { kind: "NONE" | "DAILY" | "WEEKLY"; weekdays: number[] }) {
  if (rule.kind === "DAILY") return 1;
  if (rule.kind !== "WEEKLY" || rule.weekdays.length === 0) return Infinity;
  const days = [...rule.weekdays].sort((a, b) => a - b);
  return Math.min(...days.map((day, index) => (index === days.length - 1 ? days[0] + 7 - day : days[index + 1] - day)));
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
  isPublic: z.boolean().default(false),
  repeat: RepeatRuleSchema.optional(),
}).superRefine((value, context) => {
  const startsAt = new Date(value.startsAt);
  const endsAt = new Date(value.endsAt);
  if (endsAt <= startsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after start time." });
  }
  if (dateInTimezone(startsAt, value.timezone) !== value.localDate) {
    context.addIssue({ code: "custom", path: ["localDate"], message: "Date must match the event time zone." });
  }
  const spanDays = eventSpanDays(startsAt, endsAt, value.timezone);
  const repeat = value.repeat;
  if (!repeat || repeat.kind === "NONE") {
    if (spanDays > MAX_ONE_OFF_SPAN_DAYS) context.addIssue({ code: "custom", path: ["endsAt"], message: "An event can last up to 31 days." });
    return;
  }
  if (repeat.until && repeat.until < value.localDate) {
    context.addIssue({ code: "custom", path: ["repeat", "until"], message: "The last date must not be before the first." });
  }
  if (repeat.until && repeat.until > addDays(value.localDate, MAX_SERIES_DAYS)) {
    context.addIssue({ code: "custom", path: ["repeat", "until"], message: "A repeating event can run for up to two years. Leave the end empty for no end." });
  }
  if (spanDays >= shortestRepeatGap(repeat)) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "The event is longer than the time between repeats." });
  }
});

// Changes to a whole series. The times are local ("HH:mm") so they stay right through daylight saving.
export const UpdateEventSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  venue: z.string().trim().max(200).nullable().optional(),
  isPublic: z.boolean().optional(),
  repeat: RepeatRuleSchema.optional(),
  firstLocalDate: localDate.optional(),
  startLocal: time.optional(),
  endLocal: time.optional(),
  spanDays: z.number().int().min(0).max(MAX_ONE_OFF_SPAN_DAYS).optional(),
  // Cancels every date that is still scheduled. A repeating event must be fully cancelled before it can be deleted.
  cancelAll: z.literal(true).optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), "Change at least one thing.");

const optionalRegistrationUrl = z.url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Use an HTTP or HTTPS link.");

// Changes to one date of an event. Any change marks the occurrence as edited, so a later change to the
// series leaves it alone.
export const UpdateOccurrenceSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }).optional(),
  endsAt: z.iso.datetime({ offset: true }).optional(),
  status: z.enum(["SCHEDULED", "CANCELLED"]).optional(),
  changeNote: z.string().trim().max(1000).nullable().optional(),
  registrationUrl: optionalRegistrationUrl.nullable().optional(),
  attendanceCount: z.number().int().min(0).max(100000).nullable().optional(),
  // Marks a one-time event done (true) or not done (false).
  done: z.boolean().optional(),
}).superRefine((value, context) => {
  if (Object.values(value).every((entry) => entry === undefined)) {
    context.addIssue({ code: "custom", message: "Change at least one thing." });
  }
  if ((value.startsAt === undefined) !== (value.endsAt === undefined)) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Change the start and the end together." });
  } else if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after start time." });
  } else if (value.startsAt && value.endsAt && new Date(value.endsAt).getTime() - new Date(value.startsAt).getTime() > (MAX_ONE_OFF_SPAN_DAYS + 1) * 86400000 + 3600000) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "An event can last up to 31 days." });
  }
});

export const EventRangeSchema = z.object({ from: localDate, to: localDate }).refine(
  (value) => value.from <= value.to && (Date.parse(value.to) - Date.parse(value.from)) <= 93 * 86400000,
  "Select a range of up to 93 days.",
);
