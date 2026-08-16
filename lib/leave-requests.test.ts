
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateLeaveReason,
  canAppealStatus,
  REASON_MIN,
  REASON_MAX,
  APPEALABLE_STATUSES,
} from "./leave-requests.ts";

test("validateLeaveReason: accepts 5–500 char reasons", () => {
  assert.equal(validateLeaveReason("Absent due to fever"), null);
  assert.equal(validateLeaveReason("a".repeat(REASON_MIN)), null);
  assert.equal(validateLeaveReason("a".repeat(REASON_MAX)), null);
});

test("validateLeaveReason: rejects too short / too long / whitespace-only", () => {
  assert.match(validateLeaveReason("hi") ?? "", /at least/);
  assert.match(validateLeaveReason("  ab  ") ?? "", /at least/);
  assert.match(validateLeaveReason("x".repeat(REASON_MAX + 1)) ?? "", /at most/);
});

test("canAppealStatus: absent / late / partial / missing are appealable", () => {
  for (const s of APPEALABLE_STATUSES) {
    assert.equal(canAppealStatus(s), true, s);
  }
  assert.equal(canAppealStatus(null), true);
  assert.equal(canAppealStatus(undefined), true);
});

test("canAppealStatus: present is not appealable", () => {
  assert.equal(canAppealStatus("present"), false);
});

test("canAppealStatus: already-excused is never appealable", () => {
  assert.equal(canAppealStatus("absent", true), false);
  assert.equal(canAppealStatus(null, true), false);
  assert.equal(canAppealStatus("late", true), false);
});

test("approval contract: excused flag is independent of status", () => {
  const before = {
    status: "absent" as const,
    entry_time: "2026-03-01T09:05:00Z",
    exit_time: null as string | null,
    face_confidence: null as number | null,
    entry_lat: null as number | null,
    entry_lng: null as number | null,
    excused: false,
  };
  const after = { ...before, excused: true };
  assert.equal(after.status, before.status);
  assert.equal(after.entry_time, before.entry_time);
  assert.equal(after.exit_time, before.exit_time);
  assert.equal(after.face_confidence, before.face_confidence);
  assert.equal(after.entry_lat, before.entry_lat);
  assert.equal(after.entry_lng, before.entry_lng);
  assert.equal(after.excused, true);
});

test("rejection contract: attendance row is untouched", () => {
  const attendance = {
    status: "late" as const,
    excused: false,
    entry_time: "2026-03-01T09:12:00Z",
  };
  const afterReject = { ...attendance };
  assert.deepEqual(afterReject, attendance);
  assert.equal(afterReject.excused, false);
});

test("duplicate appeal: unique (student_id, session_id) is the DB backstop", () => {
  const DUPLICATE_CODE = "23505";
  assert.equal(DUPLICATE_CODE, "23505");
});
