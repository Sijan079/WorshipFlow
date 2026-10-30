import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCK_SECONDS, lockStatus, lockExpiry } from "./page-lock.ts";

const now = new Date("2026-10-30T10:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

test("a page nobody is editing is free", () => {
  assert.equal(lockStatus({ lockedById: null, lockedAt: null }, "me", now), "free");
});

test("my own recent lock is mine", () => {
  assert.equal(lockStatus({ lockedById: "me", lockedAt: ago(10) }, "me", now), "mine");
});

test("someone else's recent lock keeps me out", () => {
  assert.equal(lockStatus({ lockedById: "them", lockedAt: ago(10) }, "me", now), "other");
});

test("a lock nobody renewed is free again, so a closed laptop never locks the page for long", () => {
  assert.equal(lockStatus({ lockedById: "them", lockedAt: ago(LOCK_SECONDS + 1) }, "me", now), "free");
  assert.equal(lockStatus({ lockedById: "them", lockedAt: ago(LOCK_SECONDS - 1) }, "me", now), "other");
});

test("an old lock of mine is free too", () => {
  assert.equal(lockStatus({ lockedById: "me", lockedAt: ago(LOCK_SECONDS + 5) }, "me", now), "free");
});

test("the time before which a lock counts as expired is a fixed span back from now", () => {
  assert.equal(lockExpiry(now).getTime(), now.getTime() - LOCK_SECONDS * 1000);
});

test("the lock lasts long enough for the editor's renewals to keep it", () => {
  assert.ok(LOCK_SECONDS >= 40, "renewed every 20 seconds, with room for a slow network");
});
