import assert from "node:assert/strict";
import { getPAPDeviceName } from "./pap-device-name.ts";

export function runPAPDeviceNameTests() {
  assert.equal(getPAPDeviceName("desktop").startsWith("Worship Flow Desktop"), true);
  assert.equal(getPAPDeviceName("mobile").length > 0, true);
}
