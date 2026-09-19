import assert from "node:assert/strict";
import test from "node:test";
import { draftSaveState } from "./save-status.ts";

test("only a confirmed saved draft gets a green check", () => {
  assert.equal(draftSaveState("Saved on this device"), "saved");
  assert.equal(draftSaveState("Saved across your devices"), "saved");
  assert.equal(draftSaveState("Editing moved to another device. This copy is read-only."), "unavailable");
  for (const status of ["Saving changes…", "No saved draft", "Draft recovered on this device", "Checking draft recovery…", "Name not applied yet"]) {
    assert.equal(draftSaveState(status), "pending");
  }
  for (const status of ["Draft not saved on this device — export to keep your work", "Device recovery unavailable for this session", "Could not remove the saved draft from this device"]) {
    assert.equal(draftSaveState(status), "unavailable");
  }
});
