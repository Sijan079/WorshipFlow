import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isPublicPathForProxy } from "./proxy-paths.ts";
import { checkCronAuthorization } from "./cron-auth.ts";
import { runsAtMostOncePerDay } from "./cron-schedule.ts";

const SECRET = "a".repeat(40);

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

export function runCronAuthTests() {
  // The cron secret arrives as "Authorization: Bearer <secret>". Nothing else gets in.
  assert.equal(checkCronAuthorization(`Bearer ${SECRET}`, SECRET), "ok");
  assert.equal(checkCronAuthorization(null, SECRET), "unauthorized");
  assert.equal(checkCronAuthorization("", SECRET), "unauthorized");
  assert.equal(checkCronAuthorization(SECRET, SECRET), "unauthorized");
  assert.equal(checkCronAuthorization(`Bearer ${"b".repeat(40)}`, SECRET), "unauthorized");
  assert.equal(checkCronAuthorization(`Bearer ${SECRET}x`, SECRET), "unauthorized");
  assert.equal(checkCronAuthorization("Bearer ", SECRET), "unauthorized");
  // A missing or weak secret means the job is not configured, never "open".
  assert.equal(checkCronAuthorization(`Bearer ${SECRET}`, undefined), "not-configured");
  assert.equal(checkCronAuthorization(`Bearer ${SECRET}`, ""), "not-configured");
  assert.equal(checkCronAuthorization("Bearer short", "short"), "not-configured");

  // Hobby allows one run per day: fixed minute and hour, every other field open.
  assert.equal(runsAtMostOncePerDay("0 3 * * *"), true);
  assert.equal(runsAtMostOncePerDay("30 14 * * *"), true);
  assert.equal(runsAtMostOncePerDay("*/30 * * * *"), false);
  assert.equal(runsAtMostOncePerDay("0 * * * *"), false);
  assert.equal(runsAtMostOncePerDay("0 3,15 * * *"), false);
  assert.equal(runsAtMostOncePerDay("0 3 * * 1"), false);
  assert.equal(runsAtMostOncePerDay("0 3 * *"), false);

  // The daily schedule is configured in vercel.json and points at the protected route.
  const config = JSON.parse(read("vercel.json")) as { crons?: Array<{ path: string; schedule: string }> };
  assert.equal(config.crons?.length, 1);
  assert.equal(config.crons?.[0].path, "/api/internal/keep-alive");
  assert.equal(runsAtMostOncePerDay(config.crons?.[0].schedule ?? ""), true);

  // Vercel's cron call is not logged in, so the route is public to the proxy; it still demands
  // the secret itself. Other internal routes stay as they were.
  assert.equal(isPublicPathForProxy("/api/internal/keep-alive"), true);
  assert.equal(isPublicPathForProxy("/api/internal/other"), false);

  // The route: GET only, always fresh, no church data, one small idempotent write, and a
  // failure is reported instead of swallowed.
  const route = read("src", "app", "api", "internal", "keep-alive", "route.ts");
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /checkCronAuthorization\(request\.headers\.get\("authorization"\), process\.env\.CRON_SECRET\)/);
  assert.match(route, /ON CONFLICT \("id"\) DO UPDATE SET "lastRunAt"/);
  assert.match(route, /Cache-Control": "no-store"/);
  assert.match(route, /reportRouteFailure/);
  assert.doesNotMatch(route, /"Person"|"Workspace"|"WorshipService"|"Ministry"/);
  assert.doesNotMatch(route, /\+ 1|increment/i);

  // A single-row table that holds no church data, with row-level security like the others.
  const schema = read("prisma", "schema.prisma");
  assert.match(schema, /^model KeepAlive \{[\s\S]*?lastRunAt\s+DateTime[\s\S]*?^\}/m);
  const migrations = join(process.cwd(), "prisma", "migrations-current");
  const folder = readdirSync(migrations).find((name) => name.endsWith("_keep_alive"));
  assert.ok(folder, "Expected a *_keep_alive migration");
  const sql = read("prisma", "migrations-current", folder, "migration.sql");
  assert.match(sql, /CREATE TABLE "KeepAlive"/);
  assert.match(sql, /ALTER TABLE "KeepAlive" ENABLE ROW LEVEL SECURITY/);
  assert.equal(existsSync(join(migrations, folder, "migration.sql")), true);

  // The secret is documented for whoever deploys this.
  assert.match(read(".env.example"), /^CRON_SECRET=/m);
  assert.match(read("README.md"), /CRON_SECRET/);
}
