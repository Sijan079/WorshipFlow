import assert from "node:assert/strict";
import { DEVICE_PRESETS } from "./device-presets.ts";
import {
  calculateFillTransform,
  calculateFitTransform,
  calculateStretchTransform,
  canReuseSourceImage,
  detectContentBounds,
  generateOutputFilename,
  getTargetDimensions,
  validateTargetDimensions,
} from "./resize-image.ts";

export function runResizeImageTests() {
  const pixels = new Uint8ClampedArray(6 * 8 * 4);
  for (let y = 3; y <= 5; y += 1) {
    for (let x = 0; x < 6; x += 1) {
      const offset = (y * 6 + x) * 4;
      pixels.set([40, 40, 40, 255], offset);
    }
  }
  assert.deepEqual(detectContentBounds(pixels, 6, 8), {
    x: 0,
    y: 3,
    width: 6,
    height: 3,
  });

  assert.deepEqual(
    calculateFitTransform({
      sourceWidth: 1000,
      sourceHeight: 1000,
      targetWidth: 1920,
      targetHeight: 1080,
    }),
    {
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 1000,
      sourceHeight: 1000,
      destinationX: 420,
      destinationY: 0,
      destinationWidth: 1080,
      destinationHeight: 1080,
      canvasWidth: 1920,
      canvasHeight: 1080,
    }
  );

  const centeredFill = calculateFillTransform({
    sourceWidth: 1000,
    sourceHeight: 1000,
    targetWidth: 2000,
    targetHeight: 1000,
    crop: { zoom: 1, positionX: 0, positionY: 0 },
  });
  assert.equal(centeredFill.destinationY, -500);
  assert.equal(centeredFill.destinationWidth, 2000);

  const movedFill = calculateFillTransform({
    sourceWidth: 1000,
    sourceHeight: 1000,
    targetWidth: 2000,
    targetHeight: 1000,
    crop: { zoom: 2, positionX: 1, positionY: -1 },
  });
  assert.equal(movedFill.destinationX, -2000);
  assert.equal(movedFill.destinationY, 0);

  assert.equal(calculateStretchTransform({
    sourceWidth: 1000,
    sourceHeight: 500,
    targetWidth: 1080,
    targetHeight: 2400,
  }).destinationHeight, 2400);

  const freeShow = DEVICE_PRESETS.find((preset) => preset.id === "freeshow-1920x1080")!;
  assert.deepEqual(getTargetDimensions(freeShow, 0, 0, "landscape"), {
    width: 1920,
    height: 1080,
  });

  assert.equal(validateTargetDimensions(1080, 2400), null);
  assert.match(validateTargetDimensions(10_000, 10_000)!, /40,000,000/);
  assert.match(validateTargetDimensions(10.5, 100)!, /whole numbers/);
  assert.equal(
    canReuseSourceImage({ width: 1080, height: 2400 }, { width: 1080, height: 2400 }, true, false),
    true
  );
  assert.equal(
    canReuseSourceImage({ width: 1080, height: 2400 }, { width: 1080, height: 2400 }, true, true),
    false
  );
  assert.equal(
    generateOutputFilename("Sunday Screen (Final).PNG", freeShow.id, "landscape", "jpeg"),
    "sunday-screen-final-freeshow-1920x1080-landscape.jpg"
  );
}
