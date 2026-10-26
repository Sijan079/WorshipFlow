import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MOJIBAKE = /â€|Â[\s·©®]|Ã[\u0080-¿]/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

export function runSourceEncodingTests() {
  const damaged = sourceFiles(join(process.cwd(), "src")).filter((path) => MOJIBAKE.test(readFileSync(path, "utf8")));
  assert.deepEqual(damaged, [], "Source files contain garbled UTF-8 text (for example an ellipsis or middle dot)");
}
