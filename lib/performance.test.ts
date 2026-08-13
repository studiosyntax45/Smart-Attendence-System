
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzePerformance,
  predictPerformance,
  MARKS_GOOD_THRESHOLD,
} from "./performance.ts";
import { ELIGIBILITY_THRESHOLD } from "./attendance.ts";

test("analyze: high attendance + high marks â†’ excellent", () => {
  const a = analyzePerformance({ attendancePct: 96, marksPct: 91 });
  assert.ok(a);
  assert.equal(a.attendanceBand, "good");
  assert.equal(a.marksBand, "good");
  assert.equal(a.atRisk, false);
  assert.match(a.feedback, /Excellent performance/i);
});

test("analyze: low attendance + low marks â†’ both need attention", () => {
  const a = analyzePerformance({ attendancePct: 72, marksPct: 58 });
  assert.ok(a);
  assert.equal(a.attendanceBand, "low");
  assert.equal(a.marksBand, "low");
  assert.equal(a.atRisk, true);
  assert.match(a.feedback, /attendance is below the recommended level/i);
});

test("analyze: high attendance + low marks â†’ academics need focus", () => {
  const a = analyzePerformance({ attendancePct: 94, marksPct: 55 });
  assert.ok(a);
  assert.equal(a.attendanceBand, "good");
  assert.equal(a.marksBand, "low");
  assert.equal(a.atRisk, true);
  assert.match(a.feedback, /attendance is good, but your academic performance/i);
});

test("analyze: low attendance + high marks â†’ attendance at risk", () => {
  const a = analyzePerformance({ attendancePct: 68, marksPct: 87 });
  assert.ok(a);
  assert.equal(a.attendanceBand, "low");
  assert.equal(a.marksBand, "good");
  assert.equal(a.atRisk, true);
  assert.match(a.feedback, /low attendance may impact your future/i);
});

test("analyze: band boundaries are inclusive at the threshold", () => {
  const att = analyzePerformance({
    attendancePct: ELIGIBILITY_THRESHOLD,
    marksPct: MARKS_GOOD_THRESHOLD,
  });
  assert.ok(att);
  assert.equal(att.attendanceBand, "good");
  assert.equal(att.marksBand, "good");

  const below = analyzePerformance({
    attendancePct: ELIGIBILITY_THRESHOLD - 0.01,
    marksPct: MARKS_GOOD_THRESHOLD - 0.01,
  });
  assert.ok(below);
  assert.equal(below.attendanceBand, "low");
  assert.equal(below.marksBand, "low");
});

test("analyze: null on either axis â†’ insufficient data", () => {
  assert.equal(analyzePerformance({ attendancePct: null, marksPct: 80 }), null);
  assert.equal(analyzePerformance({ attendancePct: 80, marksPct: null }), null);
  assert.equal(analyzePerformance({ attendancePct: null, marksPct: null }), null);
});

test("analyze: out-of-range inputs are clamped, not trusted", () => {
  const a = analyzePerformance({ attendancePct: 130, marksPct: -5 });
  assert.ok(a);
  assert.equal(a.attendancePct, 100);
  assert.equal(a.marksPct, 0);
  assert.equal(a.marksBand, "low");
});

test("predict: strong student â†’ low risk, high improvement, top grade", () => {
  const p = predictPerformance({ attendancePct: 96, marksPct: 91 });
  assert.ok(p);
  assert.equal(p.riskLevel, "Low");
  assert.equal(p.improvementProbability, "High");
  assert.equal(p.expectedGrade, "S");
  assert.equal(p.projectedPct, 92);
});

test("predict: engaged but weak marks â†’ medium/high risk, high improvement", () => {
  const p = predictPerformance({ attendancePct: 94, marksPct: 55 });
  assert.ok(p);
  assert.equal(p.improvementProbability, "High");
  assert.notEqual(p.riskLevel, "Low");
});

test("predict: both low â†’ high risk, low improvement", () => {
  const p = predictPerformance({ attendancePct: 55, marksPct: 45 });
  assert.ok(p);
  assert.equal(p.riskLevel, "High");
  assert.equal(p.improvementProbability, "Low");
});

test("predict: capable but absent â†’ medium improvement (needs to show up)", () => {
  const p = predictPerformance({ attendancePct: 68, marksPct: 87 });
  assert.ok(p);
  assert.equal(p.improvementProbability, "Medium");
});

test("predict: failing projection is always high risk", () => {
  const p = predictPerformance({ attendancePct: 80, marksPct: 30 });
  assert.ok(p);
  const fail = predictPerformance({ attendancePct: 70, marksPct: 20 });
  assert.ok(fail);
  assert.equal(fail.riskLevel, "High");
  assert.equal(fail.expectedGrade, "F");
});

test("predict: null on either axis â†’ no prediction", () => {
  assert.equal(predictPerformance({ attendancePct: null, marksPct: 80 }), null);
  assert.equal(predictPerformance({ attendancePct: 80, marksPct: null }), null);
});
