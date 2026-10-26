import { timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 32;
const BEARER = "Bearer ";

export type CronAuthorization = "ok" | "not-configured" | "unauthorized";

// Vercel sends CRON_SECRET as "Authorization: Bearer <secret>". A missing or short secret means
// the job is not configured, never "open". The comparison takes the same time however close a
// guess is.
export function checkCronAuthorization(header: string | null, secret: string | undefined): CronAuthorization {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return "not-configured";
  if (!header || !header.startsWith(BEARER)) return "unauthorized";
  const supplied = Buffer.from(header.slice(BEARER.length));
  const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return "unauthorized";
  return "ok";
}
