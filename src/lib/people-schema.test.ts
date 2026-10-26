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
  for (const field of ["workspaceId", "name", "status", "gender", "birthdate", "baptismStatus", "baptismDate", "createdByUserId", "updatedByUserId"]) {
    assert.ok(person.split(/[^A-Za-z]+/).includes(field), `Person.${field}`);
  }

  const ministry = modelBlock(schema, "Ministry");
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
