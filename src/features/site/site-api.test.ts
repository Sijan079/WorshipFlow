import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");
const list = () => read("src", "app", "api", "site", "pages", "route.ts");
const one = () => read("src", "app", "api", "site", "pages", "[id]", "route.ts");

test("every page route asks for the Site permission that matches what it does", () => {
  assert.match(list(), /export async function GET[\s\S]*?requireSiteAction\("VIEW"\)/);
  assert.match(list(), /export async function POST[\s\S]*?requireSiteAction\("CREATE"\)/);
  assert.match(one(), /export async function GET[\s\S]*?requireSiteAction\("VIEW"\)/);
  assert.match(one(), /export async function PATCH[\s\S]*?requireSiteAction\("EDIT"\)/);
  assert.match(one(), /export async function DELETE[\s\S]*?requireSiteAction\("DELETE"\)/);
});

test("every Site action also needs View, and every query is limited to the church", () => {
  assert.match(read("src", "features", "site", "site-access.ts"), /hasModuleAction\(context, "SITE", "VIEW"\)/);
  for (const source of [list(), one()]) {
    // Every where clause names the church, or the page of a block (the page was already checked against the church).
    for (const clause of source.match(/where: \{[^}]*\}/g) ?? []) assert.match(clause, /workspaceId|pageId/, `no query by id alone: ${clause}`);
  }
  assert.match(one(), /workspaceId: context\.workspaceId/);
});

test("publishing goes through the one rule, and creating always makes a draft", () => {
  assert.match(one(), /decidePageUpdate\(/);
  assert.doesNotMatch(read("src", "features", "site", "pages", "page-validation.ts"), /CreatePageSchema = z\.strictObject\(\{[^}]*status/);
});

test("deleting a page holds the draft rule inside the delete itself, and never deletes the home page", () => {
  assert.match(one(), /deleteMany\(\{ where: \{ id, workspaceId: context\.workspaceId, status: "DRAFT" \} \}\)/);
  assert.match(one(), /canDeletePage\(/);
});

test("the Site permission is grantable from Settings", () => {
  assert.match(read("src", "app", "api", "workspaces", "[workspaceSlug]", "members", "permissions", "route.ts"), /"SITE"/);
});

test("the website settings route reads with View, writes with Edit, and keeps the search switch behind Publish", () => {
  const route = read("src", "app", "api", "site", "settings", "route.ts");
  assert.match(route, /export async function GET[\s\S]*?requireSiteAction\("VIEW"\)/);
  assert.match(route, /export async function PATCH[\s\S]*?requireSiteAction\("EDIT"\)/);
  assert.match(route, /decideSettingsUpdate\(/);
  for (const clause of route.match(/where: \{[^}]*\}/g) ?? []) assert.match(clause, /workspaceId/, `no query without the church: ${clause}`);
});
