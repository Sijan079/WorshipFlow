import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { findDependencies, findReferences, findSymbols } from "./codemap-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(readFileSync(path.join(root, "docs/codebase-map/symbols.json"), "utf8"));

test("find returns a bounded source location and symbol dependencies", () => {
  const result = findSymbols(registry, "getActiveWorkspaceId");
  assert.equal(result.results[0].name, "getActiveWorkspaceId");
  assert.equal(result.results[0].file, "src/lib/security-context.ts");
  assert.equal(result.results[0].line, 24);
  assert.ok(result.results[0].dependencies.includes("./prisma.ts"));
  assert.ok(result.results.length <= 10);
});

test("refs finds AST references in importing routes without dumping all matches", () => {
  const result = findReferences(registry, "getActiveWorkspaceId", root);
  assert.ok(result.total > 0);
  assert.ok(result.results.some((item) => item.file === "src/app/api/media/backgrounds/route.ts" && item.line === 10));
  assert.ok(result.results.length <= 10);
  assert.ok(result.results.every((item) => item.name === "getActiveWorkspaceId"));
});

test("deps narrows to a matching file and returns its imports", () => {
  const result = findDependencies(registry, "security-context");
  assert.ok(result.results.some((item) => item.file === "src/lib/security-context.ts"));
  assert.ok(result.results.find((item) => item.file === "src/lib/security-context.ts").dependencies.includes("./prisma.ts"));
  assert.ok(result.results.length <= 10);
});
