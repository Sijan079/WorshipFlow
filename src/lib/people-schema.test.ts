import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function modelOrEnum(schema: string, header: string) {
  const start = schema.indexOf(`${header} {`);
  assert.ok(start >= 0, `${header} is missing from prisma/schema.prisma`);
  return schema.slice(start, schema.indexOf("\n}", start) + 2);
}

function modelBlock(schema: string, name: string) {
  const start = schema.indexOf(`model ${name} {`);
  assert.ok(start >= 0, `model ${name} is missing from prisma/schema.prisma`);
  const end = schema.indexOf("\n}", start);
  return schema.slice(start, end + 2);
}

export function runPeopleSchemaTests() {
  const root = process.cwd();
  const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");

  assert.match(schema, /^enum PersonStatus \{[\s\S]*?VISITOR[\s\S]*?REGULAR[\s\S]*?MEMBER[\s\S]*?INACTIVE[\s\S]*?ARCHIVED[\s\S]*?\}/m);
  assert.match(schema, /^enum BaptismStatus \{[\s\S]*?BAPTIZED[\s\S]*?NOT_BAPTIZED[\s\S]*?UNKNOWN[\s\S]*?\}/m);

  const person = modelBlock(schema, "Person");
  for (const field of ["workspaceId", "firstName", "lastName", "status", "gender", "birthdate", "baptismStatus", "baptismDate", "createdByUserId", "updatedByUserId"]) {
    assert.ok(person.split(/[^A-Za-z]+/).includes(field), `Person.${field}`);
  }

  assert.equal(person.split(/[^A-Za-z]+/).includes("name"), false, "Person has first and last name, not one name field");
  assert.match(person, /\bfirstName\s+String\s*$/m);
  assert.match(person, /\blastName\s+String\s*$/m);
  assert.match(modelBlock(schema, "WorshipService"), /\bministryId\s+String\?/);

  const namesFolder = readdirSync(join(root, "prisma", "migrations-current")).find((name) => name.endsWith("_person_names_and_service_ministry"));
  assert.ok(namesFolder, "Expected a *_person_names_and_service_ministry migration");
  const namesSql = readFileSync(join(root, "prisma", "migrations-current", namesFolder, "migration.sql"), "utf8");
  assert.match(namesSql, /ADD COLUMN "firstName"/);
  assert.match(namesSql, /ADD COLUMN "lastName"/);
  assert.match(namesSql, /UPDATE "WorshipService"/, "Existing services keep their ministry");

  // The old roster drop was applied on the owner's instruction (2026-10-27), so it is now a current migration.
  const dropFolder = readdirSync(join(root, "prisma", "migrations-current")).find((name) => name.endsWith("_drop_servants"));
  assert.ok(dropFolder, "Expected prisma/migrations-current/*_drop_servants");
  const dropSql = readFileSync(join(root, "prisma", "migrations-current", dropFolder, "migration.sql"), "utf8");
  assert.match(dropSql, /DROP TABLE "Servant"/);
  assert.match(dropSql, /DROP TABLE "ServantGroupPreset"/);

  const ministry = modelBlock(schema, "Ministry");
  assert.match(ministry, /\bserviceOnly\s+Boolean\b/);
  const serviceOnlyFolder = readdirSync(join(root, "prisma", "migrations-current")).find((name) => name.endsWith("_ministry_service_only"));
  assert.ok(serviceOnlyFolder, "Expected a *_ministry_service_only migration");
  const serviceOnlySql = readFileSync(join(root, "prisma", "migrations-current", serviceOnlyFolder, "migration.sql"), "utf8");
  assert.match(serviceOnlySql, /ADD COLUMN "serviceOnly" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(serviceOnlySql, /SET "serviceOnly" = true WHERE "code" = 'MIXED'/);
  assert.match(ministry, /@@unique\(\[workspaceId, code\]\)/);
  assert.match(ministry, /\bleaderId\b/);

  assert.match(modelBlock(schema, "PersonMinistry"), /@@id\(\[personId, ministryId\]\)/);
  assert.match(modelBlock(schema, "ServiceServantAssignment"), /\bpersonId\s+String\?/);
  assert.match(modelBlock(schema, "BlockPerson"), /\bpersonId\s+String\?/);

  const migrationsDir = join(root, "prisma", "migrations-current");
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith("_people_and_ministries"));
  assert.ok(folder, "Expected a *_people_and_ministries migration");
  const sql = readFileSync(join(migrationsDir, folder, "migration.sql"), "utf8");

  assert.match(sql, /CHECK \("baptismDate" IS NULL OR "baptismStatus" = 'BAPTIZED'\)/);
  for (const table of ["Person", "Ministry", "PersonMinistry"]) {
    assert.match(sql, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`), `${table} needs row level security`);
  }
  assert.match(sql, /INSERT INTO "Ministry"/, "Existing workspaces need the default ministries");
  assert.doesNotMatch(sql, /DROP TABLE "Servant"/, "The Servant table stays until nothing references it");
  assert.equal(existsSync(join(migrationsDir, "migration_lock.toml")), true);

  // PEOPLE joins the workspace modules whose actions Admins can grant to Members.
  assert.match(modelOrEnum(schema, "enum WorkspaceModule"), /PEOPLE/);
  const permissionFolder = readdirSync(migrationsDir).find((name) => name.endsWith("_people_module_permission"));
  assert.ok(permissionFolder, "Expected a *_people_module_permission migration");
  assert.match(
    readFileSync(join(migrationsDir, permissionFolder, "migration.sql"), "utf8"),
    /ALTER TYPE "WorkspaceModule" ADD VALUE IF NOT EXISTS 'PEOPLE'/,
  );
  const permissionsRoute = readFileSync(
    join(root, "src", "app", "api", "workspaces", "[workspaceSlug]", "members", "permissions", "route.ts"),
    "utf8",
  );
  assert.match(permissionsRoute, /z\.enum\(\["EVENTS", "ANNOUNCEMENTS", "CAPTIONS", "PEOPLE"\]\)/);
}
