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

export function reviewBannerText(count: number) {
  if (count <= 0) return null;
  return count === 1
    ? "1 past event needs to be marked done or cancelled."
    : `${count} past events need to be marked done or cancelled.`;
}
