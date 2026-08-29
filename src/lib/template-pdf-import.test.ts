import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractTemplateDraftFromPdfText } from "./template-pdf-import.ts";

export function runTemplatePdfImportTests() {
  const fieldsMigration = readFileSync(join(process.cwd(), "prisma", "migrations-current", "20260818000000_template_owned_field_definitions", "migration.sql"), "utf8");
  assert.match(fieldsMigration, /ADD COLUMN IF NOT EXISTS "code" TEXT/);
  assert.match(fieldsMigration, /ADD COLUMN IF NOT EXISTS "fieldDefinition" JSONB NOT NULL DEFAULT '\{"fields":\[\]\}'/);

  const draft = extractTemplateDraftFromPdfText(`
WORSHIP SERVICE PROGRAM
REGULAR SUNDAY
I. Tawag ng Pagsamba ________________________
II. Pambungad Na Panalangin ________________________
III. Praise & Worship ________________________
XIII. Announcement ________________________
NOTES
DATE _________________
`);

  assert.equal(draft.label, "Regular Sunday");
  assert.deepEqual(draft.blocks.map((block) => block.label), [
    "Tawag ng Pagsamba",
    "Pambungad Na Panalangin",
    "Praise & Worship",
    "Announcement",
  ]);
  assert.deepEqual(draft.blocks.map((block) => block.order), [0, 1, 2, 3]);
  assert.equal(draft.blocks[2].blockType, "PRAISE_AND_WORSHIP");

  const importRoute = readFileSync(join(process.cwd(), "src", "app", "api", "settings", "service-templates", "import", "route.ts"), "utf8");
  assert.match(importRoute, /createRequire\(import\.meta\.url\)/);
  assert.match(importRoute, /new Function\("nodeRequire", "packageName", "return nodeRequire\(packageName\)"\)/);
  assert.match(importRoute, /loadPdfParse\(\)/);

  const nextConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  assert.match(nextConfig, /serverExternalPackages:\s*\["pdf-parse"\]/);

  const templateRoute = readFileSync(join(process.cwd(), "src", "app", "api", "settings", "service-templates", "route.ts"), "utf8");
  assert.match(templateRoute, /create:\s*async \(workspaceId, payload\)\s*=>\s*prisma\.\$transaction/);
  assert.match(templateRoute, /resolveTemplateBlocks\(record\.id, payload\)/);
  assert.match(templateRoute, /replaceTemplateBlocks\(tx, record\.id, blocks\)/);
}
