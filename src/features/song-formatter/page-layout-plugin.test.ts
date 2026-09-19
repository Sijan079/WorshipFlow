import assert from "node:assert/strict";
import test from "node:test";
import { selectionScrollDelta } from "./scrolling.ts";

const bounds = { top: 100, bottom: 700, left: 100, right: 900 };

test("activation scroll aligns an offscreen target to the upper third without horizontal movement", () => {
  const delta = selectionScrollDelta({
    caret: { top: 900, bottom: 920, left: 950, right: 970 },
    targetTop: 900,
    bounds,
    topInset: 80,
    mode: "activation",
  });
  assert.equal(Math.round(delta.top), 555);
  assert.equal(delta.left, 0);
});

test("activation scroll leaves an already visible target unchanged", () => {
  assert.deepEqual(selectionScrollDelta({
    caret: { top: 350, bottom: 370, left: 200, right: 220 },
    targetTop: 350,
    bounds,
    topInset: 80,
    mode: "activation",
  }), { top: 0, left: 0 });
});

test("minimal scroll keeps the caret below the overlay and inside horizontal bounds", () => {
  assert.deepEqual(selectionScrollDelta({
    caret: { top: 140, bottom: 160, left: 70, right: 90 },
    targetTop: 140,
    bounds,
    topInset: 80,
    mode: "minimal",
  }), { top: -40, left: -54 });
});
