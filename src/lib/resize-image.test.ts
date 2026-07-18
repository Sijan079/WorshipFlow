import assert from "node:assert/strict";
import { DEVICE_PRESETS } from "./device-presets.ts";
import {
  calculateFillTransform,
  calculateFitTransform,
  calculateStretchTransform,
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

  const redmi = DEVICE_PRESETS.find((preset) => preset.id === "xiaomi-redmi-note-10-5g")!;
  assert.deepEqual(getTargetDimensions(redmi, 0, 0, "portrait"), { width: 1080, height: 2400 });
  assert.deepEqual(getTargetDimensions(redmi, 0, 0, "landscape"), { width: 2400, height: 1080 });

  for (const id of ["ipad-10-2", "ipad-pro-13"]) {
    const preset = DEVICE_PRESETS.find((item) => item.id === id)!;
    assert.deepEqual(getTargetDimensions(preset, 0, 0, "portrait"), {
      width: preset.portraitWidth,
      height: preset.portraitHeight,
    });
  }

  assert.equal(validateTargetDimensions(1080, 2400), null);
  assert.match(validateTargetDimensions(10_000, 10_000)!, /40,000,000/);
  assert.match(validateTargetDimensions(10.5, 100)!, /whole numbers/);
  assert.equal(
    generateOutputFilename("Sunday Screen (Final).PNG", redmi.id, "portrait", "jpeg"),
    "sunday-screen-final-xiaomi-redmi-note-10-5g-portrait.jpg"
  );
}
