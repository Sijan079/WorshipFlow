import { localTimeInZone, zonedLocalToUtc } from "./recurrence.ts";

export type RepeatChoice = "NONE" | "DAILY" | "WEEKLY";

export type NewEventForm = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  endDate: string;
  venue: string;
  description: string;
  registrationUrl: string;
  isPublic: boolean;
  repeat: RepeatChoice;
  weekdays: number[];
  ends: "NEVER" | "ON_DATE";
  until: string;
};

// Sunday is 0, as in a calendar week and in the repeat rule the server stores.
export function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function initialForm(date: string): NewEventForm {
  return {
    title: "", date, startTime: "18:00", endTime: "19:00", endDate: date, venue: "", description: "", registrationUrl: "",
    isPublic: false, repeat: "NONE", weekdays: [weekdayOf(date)], ends: "NEVER", until: "",
  };
}

export function toggleWeekday(days: number[], day: number) {
  return days.includes(day) ? days.filter((entry) => entry !== day) : [...days, day].sort((a, b) => a - b);
}

// A repeating event is one day long; only a one-time event can run across several days.
function lastDay(form: NewEventForm) {
  return form.repeat === "NONE" ? form.endDate || form.date : form.date;
}

// What stops the form from being saved, in plain words, or null when it is ready.
export function formProblem(form: NewEventForm) {
  if (!form.title.trim()) return "Enter an event name.";
  if (!form.date) return "Choose a date.";
  if (form.repeat === "NONE" && form.endDate < form.date) return "The end date cannot be before the first date.";
  const sameMoment = `${lastDay(form)}T${form.endTime}` <= `${form.date}T${form.startTime}`;
  if (sameMoment) return "The end time must be after the start time.";
  if (form.repeat === "WEEKLY" && form.weekdays.length === 0) return "Choose at least one day of the week.";
  if (form.repeat !== "NONE" && form.ends === "ON_DATE" && (!form.until || form.until < form.date)) return "Choose a last date that is not before the first.";
  return null;
}

// The body for POST /api/events. Times are read in the given time zone, not the server's.
export function buildCreatePayload(form: NewEventForm, timezone: string) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    venue: form.venue.trim() || undefined,
    localDate: form.date,
    startsAt: zonedLocalToUtc(form.date, form.startTime, timezone).toISOString(),
    endsAt: zonedLocalToUtc(lastDay(form), form.endTime, timezone).toISOString(),
    timezone,
    registrationUrl: form.registrationUrl.trim() || undefined,
    isPublic: form.isPublic,
    repeat: form.repeat === "NONE" ? undefined : {
      kind: form.repeat,
      weekdays: form.repeat === "WEEKLY" ? form.weekdays : [],
      until: form.ends === "ON_DATE" ? form.until : null,
    },
  };
}

// The value for a time input: the event's own wall-clock time, as HH:mm.
export function timeInputValue(instant: string, timezone: string) {
  return localTimeInZone(new Date(instant), timezone);
}

type OccurrenceEdit = { date: string; endDate: string; startTime: string; endTime: string };

// What stops an edit of one date from being saved, in plain words, or null.
export function occurrenceProblem(edit: OccurrenceEdit) {
  if (!edit.date || !edit.endDate) return "Choose a date.";
  if (edit.endDate < edit.date) return "The end date cannot be before the first date.";
  if (`${edit.endDate}T${edit.endTime}` <= `${edit.date}T${edit.startTime}`) return "The end time must be after the start time.";
  return null;
}

// The exact start and end for an edited date, read in the event's time zone.
export function buildOccurrenceTimes(edit: OccurrenceEdit, timezone: string) {
  return {
    startsAt: zonedLocalToUtc(edit.date, edit.startTime, timezone).toISOString(),
    endsAt: zonedLocalToUtc(edit.endDate, edit.endTime, timezone).toISOString(),
  };
}
