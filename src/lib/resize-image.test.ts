import assert from "node:assert/strict";
import { calculateContainLayout } from "./resize-image.ts";

export function runResizeImageTests() {
  assert.deepEqual(
    calculateContainLayout({
      sourceWidth: 1000,
      sourceHeight: 1000,
      targetWidth: 1920,
      targetHeight: 1080,
    }),
    {
      drawWidth: 1080,
      drawHeight: 1080,
      offsetX: 420,
      offsetY: 0,
    }
  );

  assert.deepEqual(
    calculateContainLayout({
      sourceWidth: 3000,
      sourceHeight: 1000,
      targetWidth: 1920,
      targetHeight: 1080,
    }),
    {
      drawWidth: 1920,
      drawHeight: 640,
      offsetX: 0,
      offsetY: 220,
    }
  );
}
