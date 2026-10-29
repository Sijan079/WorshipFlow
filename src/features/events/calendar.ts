export type MonthCell = { date: string; inMonth: boolean };

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getMonthCells(year: number, monthIndex: number): MonthCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const count = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, monthIndex, index - mondayOffset + 1));
    return { date: isoDate(date), inMonth: date.getUTCMonth() === monthIndex };
  });
}

// Whether the details card is shown beside the calendar. It opens when the person chooses an event (or a day
// that has one) or starts a new event, and closes with its X; otherwise the calendar has the whole width.
export function detailsCardOpen({ showForm, opened, hasSelection }: { showForm: boolean; opened: boolean; hasSelection: boolean }) {
  return showForm || (opened && hasSelection);
}

export function groupByLocalDate<T extends { localDate: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const day = grouped.get(item.localDate) ?? [];
    day.push(item);
    grouped.set(item.localDate, day);
  }
  return grouped;
}
