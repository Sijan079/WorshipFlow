type OccurrenceRow = { id: string; eventId: string; startsAt: Date; title: string; venue: string | null; timezone: string };

// A repeating event is one thing to a visitor, so it is listed once, on its next date. Soonest first.
export function nextDatePerEvent<T extends OccurrenceRow>(rows: T[], limit: number) {
  const ordered = [...rows].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const seen = new Set<string>();
  const first: T[] = [];
  for (const row of ordered) {
    if (seen.has(row.eventId)) continue;
    seen.add(row.eventId);
    first.push(row);
  }
  return first.slice(0, limit);
}
