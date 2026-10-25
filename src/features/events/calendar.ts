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

export function groupByLocalDate<T extends { localDate: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const day = grouped.get(item.localDate) ?? [];
    day.push(item);
    grouped.set(item.localDate, day);
  }
  return grouped;
}
