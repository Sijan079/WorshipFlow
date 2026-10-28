import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { isConfigurableModuleAction } from "../../lib/module-access.ts";

const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");
const route = (...segments: string[]) => join("src", "app", "api", "events", ...segments, "route.ts");

test("editing and deleting events are separate permissions an Owner can grant", () => {
  assert.equal(isConfigurableModuleAction("EVENTS", "EDIT"), true);
  assert.equal(isConfigurableModuleAction("EVENTS", "DELETE"), true);
});

test("deleting an event needs View and Delete, is scoped to the church, and removes the event with its dates", () => {
  const access = read("src", "features", "events", "event-access.ts");
  assert.match(access, /requireEventsDelete/);
  assert.match(access, /hasModuleAction\(context, "EVENTS", "DELETE"\)/);
  const source = read(route("[id]"));
  assert.match(source, /export async function DELETE/);
  assert.match(source, /requireEventsDelete\(\)/);
  assert.match(source, /prisma\.churchEvent\.deleteMany\(\{ where: \{ id, workspaceId: context\.workspaceId, occurrences:/);
  assert.match(read("prisma", "schema.prisma"), /event\s+ChurchEvent\s+@relation\(fields: \[eventId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(read(route()), /canDelete/);
});

test("editing an event or an occurrence needs both View and Edit, checked on the server", () => {
  const access = read("src", "features", "events", "event-access.ts");
  assert.match(access, /hasModuleAction\(context, "EVENTS", "VIEW"\)/);
  assert.match(access, /hasModuleAction\(context, "EVENTS", "EDIT"\)/);
  assert.match(access, /requireExplicitWorkspaceRole\("MEMBER"\)/);
  for (const file of [route("[id]"), route("occurrences", "[id]")]) {
    assert.ok(existsSync(join(process.cwd(), file)), file);
    assert.match(read(file), /requireEventsEdit\(\)/, file);
  }
});

test("creating an event stores its repeat rule and generates the occurrences in one transaction", () => {
  const source = read(route());
  assert.match(source, /initialOccurrences\(/);
  assert.match(source, /seriesShapeFromTimes\(/);
  assert.match(source, /repeatKind:/);
  assert.match(source, /isPublic: input\.isPublic/);
  assert.match(source, /createMany/);
});

test("changing a series reshapes only the future and is scoped to the church", () => {
  const source = read(route("[id]"));
  assert.match(source, /where: \{ id, workspaceId: context\.workspaceId \}/);
  assert.match(source, /buildSeriesPlan\(/);
  assert.match(source, /reshape: true/);
  assert.match(source, /\$transaction/);
  assert.match(source, /UpdateEventSchema\.safeParse/);
});

test("changing one occurrence marks it edited and is scoped to the church", () => {
  const source = read(route("occurrences", "[id]"));
  assert.match(source, /event: \{ workspaceId: context\.workspaceId \}/);
  assert.match(source, /edited: touchesSchedule/);
  assert.match(source, /UpdateOccurrenceSchema\.safeParse/);
  assert.match(source, /localDateInZone\(/);
});

test("the daily job tops up open-ended series so they keep four months ahead", () => {
  const source = read("src", "app", "api", "internal", "keep-alive", "route.ts");
  assert.match(source, /extendOpenEndedSeries\(/);
  const job = read("src", "features", "events", "event-series-db.ts");
  assert.match(job, /repeatUntil: null/);
  assert.match(job, /reshape: false/);
  assert.doesNotMatch(job, /\.delete|\.update\(/, "extending never deletes or changes existing rows");
});

test("a worship service can record an optional headcount", () => {
  // validation.ts uses the app's path alias, so the rule is checked in the source: a whole number from 0, or null.
  assert.match(read("src", "lib", "validation.ts"), /headcount: z\.number\(\)\.int\(\)\.min\(0\)\.max\(100000\)\.optional\(\)\.nullable\(\)/);
  assert.match(read("src", "app", "api", "services", "[id]", "route.ts"), /headcount: payload\.headcount/);
});

test("the events list says whether each date repeats and is public", () => {
  assert.match(read("src", "features", "events", "event-types.ts"), /isPublic: boolean/);
  assert.match(read(route()), /isPublic: occurrence\.event\.isPublic/);
});
