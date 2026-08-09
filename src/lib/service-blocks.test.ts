import assert from "node:assert/strict";
import { normalizeServiceBlockInputs } from "./service-blocks.ts";

export function runServiceBlockTests() {
  assert.deepEqual(
    normalizeServiceBlockInputs([
      { id: "block-1", label: "  Opening  ", blockType: "CUSTOM" },
      { label: "Sermon", blockType: "SERMON", order: 99 },
    ]),
    [
      { id: "block-1", label: "Opening", code: "OPENING", blockType: "CUSTOM", order: 0 },
      { label: "Sermon", code: "SERMON", blockType: "SERMON", order: 1 },
    ],
  );
}
