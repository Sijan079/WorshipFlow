type DateState = {
  repeats: boolean;
  status: "SCHEDULED" | "CANCELLED";
  doneAt: string | null;
  startsAt: string;
  endsAt: string;
};

// Done and "needs review" track one-time events only. A repeating event has many dates and is kept up to
// date by cancelling a date when it does not happen.
export function needsReview(item: DateState, now = new Date()) {
  return !item.repeats && item.status === "SCHEDULED" && item.doneAt === null && new Date(item.endsAt) < now;
}

export function canMarkDone(item: DateState, now = new Date()) {
  return !item.repeats && item.status === "SCHEDULED" && item.doneAt === null && new Date(item.startsAt) <= now;
}

export function canMarkNotDone(item: Pick<DateState, "repeats" | "doneAt">) {
  return !item.repeats && item.doneAt !== null;
}

// What the single Cancel icon can cancel: just this date, every date that is still scheduled, or both. A
// date that is already cancelled or marked done is not cancelled again, and a one-time event has no series.
export function cancelChoices(item: { canEdit: boolean; cancelled: boolean; done: boolean; repeats: boolean; activeDates: number }): Array<"this" | "all"> {
  if (!item.canEdit) return [];
  const choices: Array<"this" | "all"> = [];
  if (!item.cancelled && !item.done) choices.push("this");
  if (item.repeats && item.activeDates > 0) choices.push("all");
  return choices;
}

// The Registration section is worth showing only when there is a form link or answers to read. After the
// event is worth showing only once a headcount was recorded. An empty section would just say it is empty.
export function registrationShown(item: { registrationUrl: string | null; responseCount: number | null }) {
  return Boolean(item.registrationUrl) || item.responseCount !== null;
}

// A headcount can be recorded, or changed later, on any date that has started and is not cancelled. That
// includes the dates of a repeating event, which cannot be marked done but do have a headcount.
export function canRecordAttendance(item: { status: "SCHEDULED" | "CANCELLED"; startsAt: string }, now = new Date()) {
  return item.status === "SCHEDULED" && new Date(item.startsAt) <= now;
}

export function attendanceShown(item: { attendanceCount: number | null }) {
  return item.attendanceCount !== null;
}

export function reviewBannerText(count: number) {
  if (count <= 0) return null;
  return count === 1
    ? "1 past event needs to be marked done or cancelled."
    : `${count} past events need to be marked done or cancelled.`;
}
