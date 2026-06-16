import assert from "node:assert/strict";
import {
  describePrivateOutputStorageMode,
  getPrivateOutputPathParts,
  normalizePrivateOutputRelativePath,
} from "./private-output-storage.ts";

export function runPrivateOutputStorageTests() {
  const pathParts = getPrivateOutputPathParts("outputs", "Sunday Service.freeshow");

  assert.equal(pathParts.publicPath, null);
  assert.match(pathParts.relativePath, /^outputs\/[0-9]+-Sunday-Service\.freeshow$/);
  assert.doesNotMatch(pathParts.absolutePath, /[/\\]public[/\\]/);

  assert.equal(
    normalizePrivateOutputRelativePath(String.raw`background-images\1781595741239-worship-background.png`),
    "background-images/1781595741239-worship-background.png"
  );
  assert.equal(
    normalizePrivateOutputRelativePath("background-images/1781595741239-worship-background.png"),
    "background-images/1781595741239-worship-background.png"
  );

  assert.deepEqual(describePrivateOutputStorageMode("supabase:background-images/example.png"), {
    hasSupabaseConfig: false,
    normalizedRelativePath: "supabase:background-images/example.png",
    storageMode: "supabase",
    supabasePath: "background-images/example.png",
  });
  assert.deepEqual(describePrivateOutputStorageMode(String.raw`background-images\example.png`), {
    hasSupabaseConfig: false,
    normalizedRelativePath: "background-images/example.png",
    storageMode: "filesystem",
    supabasePath: null,
  });
}
