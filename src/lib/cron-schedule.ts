// Vercel's Hobby plan allows a cron job to run once a day: a fixed minute and hour with every
// other field open. Anything more frequent fails the deployment.
export function runsAtMostOncePerDay(schedule: string) {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const fixed = (value: string, max: number) => /^\d+$/.test(value) && Number(value) <= max;
  return fixed(minute, 59) && fixed(hour, 23) && dayOfMonth === "*" && month === "*" && dayOfWeek === "*";
}
