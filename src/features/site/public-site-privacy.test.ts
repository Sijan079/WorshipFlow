import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

// Everything the public site (/c/{slug}) is made of. No file here may reach private data.
const publicRoots = ["src/features/site/public", "src/app/c"];
const dataLayer = "src/features/site/public/public-site-data.ts";

const forbidden: Array<[RegExp, string]> = [
  [/\bprisma\.(person|personMinistry|ministry|serviceServantAssignment|blockPerson|serviceAttendance|attendance\w*)\b/i, "reads People, Ministry, attendance or assignment tables"],
  [/features\/(people|ministries)\//, "imports the People or Ministry feature"],
  [/lib\/ministries/, "imports the Ministry data access"],
  [/\b(birthdate|baptism\w*|membershipStatus)\b/i, "mentions sensitive person fields"],
];

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

test("the public site has a narrow data layer", () => {
  assert.ok(existsSync(dataLayer), `${dataLayer} must exist`);
});

test("no public site file can read People, Ministry, attendance or service-assignment data", () => {
  const files = publicRoots.flatMap(sourceFiles);
  assert.ok(files.length > 0, "the public site must have source files to check");
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const [pattern, reason] of forbidden) {
      assert.ok(!pattern.test(text), `${file} ${reason}`);
    }
  }
});
