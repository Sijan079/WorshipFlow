import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("mobile tools toggle stays hidden at desktop widths", () => {
  const css = readFileSync(join(process.cwd(), "src/features/song-formatter/song-document-editor.module.css"), "utf8");
  assert.match(css, /\.tool\.mobileControlsToggle\s*\{\s*display:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*599px\)[\s\S]*?\.tool\.mobileControlsToggle\s*\{\s*display:\s*inline-flex/);
});
