import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Dialog titles are in Title Case, with small words such as "a" and "or" in lower case. Headings
// inside a page and form labels stay sentence case. (DESIGN.md, Typography; decided 2026-10-27.)

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

export function isTitleCase(title: string) {
  const words = title.split(/\s+/).filter(Boolean);
  return words.every((word, index) => {
    if (word.includes("{") || word.includes("}")) return true;
    const letters = word.replace(/[^A-Za-z]/g, "");
    if (!letters) return true;
    if (index > 0 && SMALL_WORDS.has(letters.toLowerCase())) return letters === letters.toLowerCase();
    return letters[0] === letters[0].toUpperCase();
  });
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

// The words a dialog title shows: plain text, or the quoted strings in a conditional. A quoted word
// with no space and no question mark is a comparison, not a title.
function titlesIn(markup: string) {
  if (!markup.includes('"')) return [markup.trim()];
  return [...markup.matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter((value) => value.includes(" ") || value.endsWith("?"));
}

export function runDialogTitleTests() {
  // The rule itself.
  assert.equal(isTitleCase("Audio Input"), true);
  assert.equal(isTitleCase("Invite a Member"), true);
  assert.equal(isTitleCase("Report Issue or Feedback"), true);
  assert.equal(isTitleCase("Add {selectedIds.length} to a Ministry"), true);
  assert.equal(isTitleCase("Delete {label}?"), true);
  assert.equal(isTitleCase("Share captions"), false);
  assert.equal(isTitleCase("Stop captions?"), false);
  assert.equal(isTitleCase("Invite A Member"), false);
  assert.equal(isTitleCase("Edit person"), false);

  // Every dialog in the app follows it.
  const files = sourceFiles(join(process.cwd(), "src"));
  let checked = 0;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/<DialogTitle[^>]*>([\s\S]*?)<\/DialogTitle>/g)) {
      for (const title of titlesIn(match[1])) {
        checked += 1;
        assert.ok(isTitleCase(title), `Dialog title "${title}" in ${file.replace(process.cwd(), "")} should be in Title Case`);
      }
    }
  }
  assert.ok(checked >= 20, `Expected to check at least 20 dialog titles, checked ${checked}`);
}
