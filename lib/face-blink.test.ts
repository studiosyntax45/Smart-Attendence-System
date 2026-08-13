
import { test } from "node:test";
import assert from "node:assert/strict";
import { initBlinkState, updateBlinkState } from "./face.ts";


function run(ears: number[]) {
  return ears.reduce((s, ear) => updateBlinkState(s, ear), initBlinkState());
}

test("counts a single open â†’ closed â†’ open blink", () => {
  const s = run([0.3, 0.3, 0.1, 0.09, 0.3, 0.31]);
  assert.equal(s.count, 1);
  assert.equal(s.closed, false);
});

test("does not count while eyes stay open", () => {
  assert.equal(run([0.3, 0.31, 0.29, 0.3, 0.3]).count, 0);
});

test("works for a low resting EAR that fixed thresholds would miss", () => {
  assert.equal(run([0.24, 0.24, 0.12, 0.11, 0.24, 0.25]).count, 1);
});

test("counts multiple distinct blinks", () => {
  assert.equal(run([0.3, 0.1, 0.3, 0.3, 0.1, 0.3]).count, 2);
});

test("does not double-count a single sustained closure (hysteresis)", () => {
  assert.equal(run([0.3, 0.1, 0.1, 0.1, 0.1, 0.3]).count, 1);
});

test("ignores non-finite / non-positive samples", () => {
  assert.equal(run([0.3, Number.NaN, 0, -1, 0.1, 0.3]).count, 1);
});
