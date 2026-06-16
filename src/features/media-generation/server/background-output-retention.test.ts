import assert from "node:assert/strict";
import { BACKGROUND_OUTPUT_TTL_MS, getExpiredBackgroundOutputCutoff } from "./background-output-retention.ts";

export function runBackgroundOutputRetentionTests() {
  const now = new Date("2026-06-16T12:00:00.000Z");
  const cutoff = getExpiredBackgroundOutputCutoff(now);

  assert.equal(cutoff.toISOString(), new Date(now.getTime() - BACKGROUND_OUTPUT_TTL_MS).toISOString());
}
