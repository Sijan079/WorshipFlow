import assert from "node:assert/strict";
import { getPrivateOutputPathParts } from "./private-output-storage.ts";

export function runPrivateOutputStorageTests() {
  const pathParts = getPrivateOutputPathParts("outputs", "Sunday Service.freeshow");

  assert.equal(pathParts.publicPath, null);
  assert.match(pathParts.relativePath, /^outputs[/\\][0-9]+-Sunday-Service\.freeshow$/);
  assert.doesNotMatch(pathParts.absolutePath, /[/\\]public[/\\]/);
}
