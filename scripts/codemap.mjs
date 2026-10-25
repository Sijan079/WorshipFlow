import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDependencies, findReferences, findSymbols } from "./codemap-core.mjs";
import { updateCodebaseIndex } from "./index-codebase.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "docs/codebase-map/symbols.json");
const [command, query, ...extra] = process.argv.slice(2);

if (!["find", "refs", "deps", "update"].includes(command) || command !== "update" && (!query || extra.length) || command === "update" && (query || extra.length)) {
  console.error("Usage: npm run codemap -- find|refs|deps <name> | update");
  process.exitCode = 2;
} else {
  try {
    const result = command === "update"
      ? { command, ...updateCodebaseIndex() }
      : (() => {
          const registry = JSON.parse(readFileSync(registryPath, "utf8"));
          if (command === "find") return findSymbols(registry, query);
          if (command === "refs") return findReferences(registry, query, root);
          return findDependencies(registry, query);
        })();
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ command, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  }
}
