const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type CalendarDay = {
  date: Date;
  value: string;
  inCurrentMonth: boolean;
};

export function parseCalendarDate(value: string) {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

export function formatCalendarDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCalendarDays(month: Date): CalendarDay[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstVisibleDay = new Date(month.getFullYear(), month.getMonth(), 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDay.getFullYear(), firstVisibleDay.getMonth(), firstVisibleDay.getDate() + index);
    return {
      date,
      value: formatCalendarDate(date),
      inCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
}
