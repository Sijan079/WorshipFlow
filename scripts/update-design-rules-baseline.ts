import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { countRawHexColors, countSmallTextClasses } from "../src/lib/design-rules.ts";

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return componentFiles(path);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx") ? [path] : [];
  });
}

const smallText: Record<string, number> = {};
const rawColor: Record<string, number> = {};
for (const path of componentFiles(join(process.cwd(), "src"))) {
  const source = readFileSync(path, "utf8");
  const name = relative(process.cwd(), path).split(sep).join("/");
  const small = countSmallTextClasses(source);
  const raw = countRawHexColors(source);
  if (small > 0) smallText[name] = small;
  if (raw > 0) rawColor[name] = raw;
}
const sorted = (record: Record<string, number>) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
  join(process.cwd(), "src", "lib", "design-rules-baseline.json"),
  `${JSON.stringify({ smallText: sorted(smallText), rawColor: sorted(rawColor) }, null, 2)}\n`,
);
console.log(`Baseline written: ${Object.keys(smallText).length} files with small text, ${Object.keys(rawColor).length} with raw colors.`);
