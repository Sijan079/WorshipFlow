const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ClockTime = { hour: number; minute: number; period: "AM" | "PM" };

// "18:00" as a 12-hour clock: 6, 0, PM. Midnight is 12 AM and noon is 12 PM. Anything that is not a
// 24-hour HH:mm time is not read.
export function parseTime(value: string): ClockTime | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const hour24 = Number(match[1]);
  return { hour: hour24 % 12 === 0 ? 12 : hour24 % 12, minute: Number(match[2]), period: hour24 >= 12 ? "PM" : "AM" };
}

// The 24-hour HH:mm a form keeps, from a 12-hour choice.
export function buildTime(hour: number, minute: number, period: "AM" | "PM") {
  const hour24 = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// "6:00 PM", the way people say it, or "" when there is no time yet.
export function formatTime(value: string) {
  const time = parseTime(value);
  return time ? `${time.hour}:${String(time.minute).padStart(2, "0")} ${time.period}` : "";
}

// The wheels. Each column scrolls past a fixed band in the middle; the row sitting in the band is the choice.
// The first row is in the band at scroll 0, so a row's scroll position is its index times the row height.

export function itemIndexFromScroll(scrollTop: number, itemHeight: number, count: number) {
  return Math.min(count - 1, Math.max(0, Math.round(scrollTop / itemHeight)));
}

export function scrollForIndex(index: number, itemHeight: number) {
  return index * itemHeight;
}
