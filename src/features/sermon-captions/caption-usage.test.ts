import test from "node:test";
import assert from "node:assert/strict";
import { meteredUsageDelta, summarizeCaptionUsage, totalCaptionUsage, usageUtcDay, usageUtcMonth } from "./caption-usage.ts";

test("usage groups translation calls by their UTC day and month", () => {
  assert.equal(usageUtcDay(new Date("2026-10-31T23:59:59Z")).toISOString(), "2026-10-31T00:00:00.000Z");
  assert.deepEqual(usageUtcMonth(new Date("2026-10-31T23:59:59Z")).map((date) => date.toISOString()), ["2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z"]);
});

test("monthly usage excludes adjacent months and marks missing meters", () => {
  const rows = [
    { day: new Date("2026-09-30T00:00:00Z"), meteredCharacters: 90, unmeteredRequests: 0 },
    { day: new Date("2026-10-01T00:00:00Z"), meteredCharacters: 15, unmeteredRequests: 1 },
    { day: new Date("2026-10-25T00:00:00Z"), meteredCharacters: 35, unmeteredRequests: 0 },
    { day: new Date("2026-11-01T00:00:00Z"), meteredCharacters: 70, unmeteredRequests: 0 },
  ];
  assert.deepEqual(summarizeCaptionUsage(rows, new Date("2026-10-25T00:00:00Z")), { meteredCharacters: 50, unmeteredRequests: 1 });
});

test("usage counts known metering and flags a successful translation with no meter", () => {
  assert.deepEqual(meteredUsageDelta(37), { meteredCharacters: 37, unmeteredRequests: 0 });
  assert.deepEqual(meteredUsageDelta(null), { meteredCharacters: 0, unmeteredRequests: 1 });
});

test("resource baseline and later app metering form the displayed estimate", () => {
  assert.deepEqual(totalCaptionUsage(8538, { meteredCharacters: 37, unmeteredRequests: 1 }), {
    baselineCharacters: 8538,
    appCharacters: 37,
    estimatedCharacters: 8575,
    unmeteredRequests: 1,
  });
  assert.equal(totalCaptionUsage(null, { meteredCharacters: 37, unmeteredRequests: 0 }).estimatedCharacters, 37);
});
