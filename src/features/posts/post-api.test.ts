import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { canShowModuleNavigation, isConfigurableModuleAction } from "../../lib/module-access.ts";

const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");
const api = (...segments: string[]) => join("src", "app", "api", "announcements", ...segments, "route.ts");

test("the Announcements permissions can be assigned: view, create, edit, delete and publish", () => {
  for (const action of ["VIEW", "CREATE", "EDIT", "DELETE", "PUBLISH"]) assert.equal(isConfigurableModuleAction("ANNOUNCEMENTS", action), true, action);
  assert.equal(isConfigurableModuleAction("ANNOUNCEMENTS", "OPERATE"), false);
});

test("the sidebar shows Announcements only to people who can view them", () => {
  assert.equal(canShowModuleNavigation("/announcements", true, true, true, false), false);
  assert.equal(canShowModuleNavigation("/announcements", false, false, false, true), true);
  assert.match(read("src", "components", "workspace-shell.tsx"), /href: "\/announcements"/);
  assert.match(read("src", "app", "api", "auth", "session", "route.ts"), /canViewAnnouncements/);
});

test("the Announcements page checks View on the server", () => {
  const page = read("src", "app", "w", "[workspaceSlug]", "[[...path]]", "page.tsx");
  assert.match(page, /case "announcements"/);
  assert.match(page, /hasModuleAction\(context, "ANNOUNCEMENTS", "VIEW"\)/);
});

test("the database gets a Post table with a kind, and the old table is left alone", () => {
  const schema = read("prisma", "schema.prisma");
  assert.match(schema, /enum PostKind \{\s+ANNOUNCEMENT\s+ARTICLE\s+\}/);
  assert.match(schema, /enum PostStatus \{\s+DRAFT\s+PUBLISHED\s+\}/);
  assert.match(schema, /model Post \{/);
  assert.match(schema, /model EventAnnouncement \{/, "the old table stays until the final cleanup");
  const migration = readdirSync(join(process.cwd(), "prisma", "migrations-current")).find((entry) => entry.endsWith("_posts"));
  assert.ok(migration, "a *_posts migration");
  const sql = read("prisma", "migrations-current", migration, "migration.sql");
  assert.match(sql, /CREATE TABLE "Post"/);
  assert.match(sql, /Post_eventId_fkey[^;]*ON DELETE SET NULL/, "deleting an event clears the link");
  assert.doesNotMatch(sql, /DROP|DELETE FROM|TRUNCATE|RENAME/i, "additive only");
});

test("every announcements query is limited to the church and to announcements", () => {
  for (const file of [api(), api("[id]")]) {
    assert.ok(existsSync(join(process.cwd(), file)), file);
    const source = read(file);
    assert.match(source, /workspaceId: context\.workspaceId/, file);
    assert.match(source, /kind: "ANNOUNCEMENT"/, file);
  }
});

test("creating checks Create, publishing checks Publish, and authorship comes from the session", () => {
  const access = read("src", "features", "posts", "post-access.ts");
  assert.match(access, /hasModuleAction\(context, "ANNOUNCEMENTS", "PUBLISH"\)/);
  const create = read(api());
  assert.match(create, /requireAnnouncementAction\("CREATE"\)/);
  assert.match(create, /CreateAnnouncementSchema\.safeParse/);
  assert.match(create, /createdById: context\.userId/);
  assert.match(create, /status: 403/);
  assert.doesNotMatch(create, /input\.createdById|body\.createdById/);
});

test("a linked event must belong to the same church, and the event list is only offered to people who can view events", () => {
  const create = read(api());
  assert.match(create, /churchEvent\.findFirst\(\{ where: \{ id: [^}]*workspaceId: context\.workspaceId/);
  const update = read(api("[id]"));
  assert.match(update, /churchEvent\.findFirst\(\{ where: \{ id: [^}]*workspaceId: context\.workspaceId/);
  assert.match(read(api()), /hasModuleAction\(context, "EVENTS", "VIEW"\)/);
});

test("changing an announcement uses the shared rule, and deleting is atomic and drafts only", () => {
  const source = read(api("[id]"));
  assert.match(source, /decideAnnouncementUpdate\(/);
  assert.match(source, /updatedById: context\.userId/);
  assert.match(source, /requireAnnouncementAction\("EDIT"\)/);
  assert.match(source, /requireAnnouncementAction\("DELETE"\)/);
  assert.match(source, /deleteMany\(\{ where: \{ id, workspaceId: context\.workspaceId, kind: "ANNOUNCEMENT", status: "DRAFT" \} \}\)/);
  assert.match(source, /status: 409/);
});

test("the event panel can start an announcement for an event", () => {
  assert.match(read("src", "app", "api", "events", "route.ts"), /canCreateAnnouncement/);
  assert.ok(read("src", "features", "events", "event-details.tsx").includes("Announce this event"));
});

test("the screen offers groups, the website switch, social copy and the Publish rule", () => {
  const screen = ["announcements-page-client.tsx", "announcement-details.tsx", "announcement-form.tsx"].map((file) => read("src", "features", "posts", file)).join("\n");
  for (const text of ["Drafts", "Live now", "Scheduled", "Ended", "New announcement", "Only people who can publish can change this.", "Publish", "Unpublish", "Fill from announcement", "Copy", "Delete announcement", "Saving moves this back to Draft until someone who can publish approves it."]) {
    assert.ok(screen.includes(text), text);
  }
  assert.match(screen, /PublicSwitch/, "the website switch is the shared one used by events");
});
