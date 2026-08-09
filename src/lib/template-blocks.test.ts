import assert from "node:assert/strict";
import { normalizeLegacyTemplateBlocks } from "./template-blocks.ts";

export function runTemplateBlockTests() {
  assert.deepEqual(
    normalizeLegacyTemplateBlocks([
      { label: "Sermon", blockType: "SERMON", order: 4 },
      { label: "Opening", blockType: "CALL_TO_WORSHIP", order: 0 },
    ]),
    [
      { label: "Opening", blockType: "CALL_TO_WORSHIP", order: 0 },
      { label: "Sermon", blockType: "SERMON", order: 1 },
    ],
  );

  assert.deepEqual(
    normalizeLegacyTemplateBlocks([{ label: "Custom Moment", blockType: "CUSTOM" }]),
    [{ label: "Custom Moment", blockType: "CUSTOM", order: 0 }],
  );
}
