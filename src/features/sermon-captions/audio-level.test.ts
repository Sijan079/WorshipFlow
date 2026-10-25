import test from "node:test";
import assert from "node:assert/strict";
import { calculateAudioLevel, resolveAudioInput } from "./audio-level.ts";

test("silent samples produce a zero input level", () => {
  assert.equal(calculateAudioLevel(new Float32Array([0, 0, 0])), 0);
});

test("audio level uses signal energy and stays within the meter range", () => {
  assert.equal(calculateAudioLevel(new Float32Array([0.5, -0.5])), 0.5);
  assert.equal(calculateAudioLevel(new Float32Array([2, -2])), 1);
});

test("a steady line-in offset or low noise settles the meter to zero", () => {
  assert.equal(calculateAudioLevel(new Float32Array([0.2, 0.2, 0.2, 0.2])), 0);
  assert.equal(calculateAudioLevel(new Float32Array([0.205, 0.195, 0.205, 0.195])), 0);
});

test("a missing selected input never falls back to a different microphone", () => {
  const devices = [{ deviceId: "room-mic", kind: "audioinput" }] as MediaDeviceInfo[];
  assert.equal(resolveAudioInput(devices, "line-in"), null);
  assert.equal(resolveAudioInput(devices, "room-mic")?.deviceId, "room-mic");
});
