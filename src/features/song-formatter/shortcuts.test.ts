import test from "node:test";
import assert from "node:assert/strict";
import { shortcutAction, shortcutKey, shortcutLabel } from "./shortcuts.ts";

test("all section actions and tag picker have stable sequences", () => {
  assert.deepEqual(["i", "s", "m", "d", "x", "t", "c", "v"].map(key => shortcutAction(key)),
    ["insert", "split", "merge", "duplicate", "delete", "tags", "copy", "paste"]);
  assert.equal(shortcutAction("ArrowUp"), undefined);
  assert.equal(shortcutAction("ArrowDown", { alt: true }), "down");
  assert.equal(shortcutAction("Escape"), undefined);
  assert.equal(shortcutLabel("duplicate", false), "Ctrl+K, D");
  assert.equal(shortcutLabel("copy", false), "Ctrl+K, C");
  assert.equal(shortcutLabel("up", false), "Ctrl+K, Alt+↑");
  assert.equal(shortcutLabel("down", true), "⌘K, ⌥↓");
  assert.equal(shortcutLabel("tags", true), "⌘K, T");
});

test("section shortcut mode stays active until it is explicitly toggled or dismissed", () => {
  assert.deepEqual(shortcutKey(false, "k", { primary: true }), { active: true, handled: true });
  assert.deepEqual(shortcutKey(true, "d"), { active: true, handled: true, action: "duplicate" });
  assert.deepEqual(shortcutKey(true, "q"), { active: true, handled: true });
  assert.deepEqual(shortcutKey(true, "c", { primary: true }), { active: true, handled: false });
  assert.deepEqual(shortcutKey(true, "v", { primary: true }), { active: true, handled: false });
  assert.deepEqual(shortcutKey(true, "c"), { active: true, handled: true, action: "copy" });
  assert.deepEqual(shortcutKey(true, "v"), { active: true, handled: true, action: "paste" });
  assert.deepEqual(shortcutKey(true, "ArrowUp"), { active: true, handled: false });
  assert.deepEqual(shortcutKey(true, "ArrowDown", { shift: true }), { active: true, handled: false });
  assert.deepEqual(shortcutKey(true, "ArrowUp", { alt: true }), { active: true, handled: true, action: "up" });
  assert.deepEqual(shortcutKey(true, "ArrowDown", { alt: true, repeat: true }), { active: true, handled: true });
  assert.deepEqual(shortcutKey(true, "ArrowUp", { primary: true, alt: true }), { active: true, handled: false });
  assert.deepEqual(shortcutKey(true, "Escape"), { active: false, handled: true });
  assert.deepEqual(shortcutKey(true, "k", { primary: true }), { active: false, handled: true });
  assert.deepEqual(shortcutKey(false, "d"), { active: false, handled: false });
});
