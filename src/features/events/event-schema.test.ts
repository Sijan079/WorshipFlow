import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");
const migration = () => read("prisma", "migrations-current", "20261028000000_event_repeat_rule", "migration.sql");

function model(schema: string, name: string) {
  const start = schema.indexOf(`model ${name} {`);
  assert.ok(start >= 0, `model ${name}`);
  return schema.slice(start, schema.indexOf("\n}", start));
}

test("the event repeat rule, public flag, edit mark and service headcount are in the schema", () => {
  const schema = read("prisma", "schema.prisma");
  assert.match(schema, /enum EventRepeatKind \{\s*NONE\s*DAILY\s*WEEKLY\s*\}/);
  const event = model(schema, "ChurchEvent");
  assert.match(event, /repeatKind\s+EventRepeatKind\s+@default\(NONE\)/);
  assert.match(event, /repeatWeekdays\s+Int\[\]\s+@default\(\[\]\)/);
  assert.match(event, /repeatUntil\s+String\?/);
  assert.match(event, /firstLocalDate\s+String\?/);
  assert.match(event, /startLocal\s+String\?/);
  assert.match(event, /endLocal\s+String\?/);
  assert.match(event, /spanDays\s+Int\s+@default\(0\)/);
  assert.match(event, /isPublic\s+Boolean\s+@default\(false\)/);
  assert.match(model(schema, "ChurchEventOccurrence"), /edited\s+Boolean\s+@default\(false\)/);
  assert.match(model(schema, "WorshipService"), /headcount\s+Int\?/);
});

test("the old recurrence columns stay until a deliberate cleanup, so the live app keeps working", () => {
  const event = model(read("prisma", "schema.prisma"), "ChurchEvent");
  for (const column of ["recurrence", "weeklyDay", "weeklyStartLocal", "weeklyEndLocal"]) assert.match(event, new RegExp(`\\b${column}\\b`), column);
});

test("the migration only adds: no drops, no type changes, no new required columns without a default", () => {
  const sql = migration();
  assert.match(sql, /CREATE TYPE "EventRepeatKind" AS ENUM \('NONE', 'DAILY', 'WEEKLY'\)/);
  assert.match(sql, /ALTER TABLE "ChurchEvent"[\s\S]*ADD COLUMN "repeatKind" "EventRepeatKind" NOT NULL DEFAULT 'NONE'/);
  assert.match(sql, /ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql, /ALTER TABLE "ChurchEventOccurrence" ADD COLUMN "edited" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql, /ALTER TABLE "WorshipService" ADD COLUMN "headcount" INTEGER/);
  assert.doesNotMatch(sql, /\bDROP\b|\bTRUNCATE\b|\bDELETE\b|ALTER COLUMN|RENAME/i);
  // Every added NOT NULL column carries a default so existing rows stay valid.
  for (const column of sql.match(/ADD COLUMN "[A-Za-z]+" [^,;]*NOT NULL[^,;]*/g) ?? []) assert.match(column, /DEFAULT/, column);
});
