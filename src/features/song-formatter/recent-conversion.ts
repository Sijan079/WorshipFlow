export function formatLastTouchedAge(value: string | undefined, now: number) {
  const touchedAt = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(touchedAt)) return "Recently";

  const minutesAgo = Math.max(0, Math.floor((now - touchedAt) / 60_000));
  if (minutesAgo < 1) return "Just now";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;

  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `${hoursAgo}hr${hoursAgo === 1 ? "" : "s"} ago`;

  const daysAgo = Math.floor(hoursAgo / 24);
  return `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
}
