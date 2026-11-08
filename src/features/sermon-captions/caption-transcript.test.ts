import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// The transcript is a private record for checking translation quality. It is written when a line is final,
// can never slow or fail a caption, and is read by nothing in the app.
export function runCaptionTranscriptTests() {
  const root = process.cwd();
  const route = readFileSync(join(root, "src", "app", "api", "caption-sessions", "[id]", "lines", "route.ts"), "utf8");
  assert.match(route, /parsed\.data\.final\s*\?\s*prisma\.captionTranscriptLine\.upsert/);
  assert.match(route, /captionTranscriptLine\.upsert[\s\S]*?\.catch\(/);

  const users = walk(join(root, "src")).filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.ts$/.test(file) && /captionTranscriptLine/.test(readFileSync(file, "utf8")));
  assert.deepEqual(users.map((file) => file.slice(root.length + 1).replace(/\\/g, "/")), ["src/app/api/caption-sessions/[id]/lines/route.ts"], "only the publish route may touch the transcript");

  const sql = readFileSync(join(root, "prisma", "migrations-current", "20261109130000_caption_transcript", "migration.sql"), "utf8");
  assert.match(sql, /ALTER TABLE "CaptionTranscriptLine" ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(sql, /CREATE POLICY/i, "no policies: the public key must not read the transcript");
  assert.match(sql, /"workspaceId_?[^"]*"|"workspaceId" TEXT NOT NULL/);
}
