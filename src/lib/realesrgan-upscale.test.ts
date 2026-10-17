import assert from "node:assert/strict";
import { buildRealEsrganArguments } from "./realesrgan-upscale.ts";

export function runRealEsrganUpscaleTests() {
  assert.deepEqual(buildRealEsrganArguments("input.png", "output.png"), [
    "-i", "input.png",
    "-o", "output.png",
    "-n", "realesrgan-x4plus",
    "-s", "4",
    "-t", "256",
    "-f", "png",
  ]);
}
