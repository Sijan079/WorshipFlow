import assert from "node:assert/strict";
import { checkRateLimitBucket, clearRateLimitBuckets, getRateLimitBucketCount } from "./rate-limit-store.ts";

export function runRateLimitTests() {
  clearRateLimitBuckets();

  checkRateLimitBucket({
    key: "expired-entry",
    limit: 1,
    windowMs: -1,
  });

  assert.equal(getRateLimitBucketCount(), 1);

  checkRateLimitBucket({
    key: "fresh-entry",
    limit: 1,
    windowMs: 1_000,
  });

  assert.equal(getRateLimitBucketCount(), 1);

  clearRateLimitBuckets();
}
