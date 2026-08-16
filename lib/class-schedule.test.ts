
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateScheduleInput,
  filterScheduleByDay,
  mapScheduleEntry,
  normaliseTime,
  formatTimeRange,
  type ScheduleEntry,
  type ScheduleEntryInput,
} from "./class-schedule.ts";

function input(partial: Partial<ScheduleEntryInput> = {}): ScheduleEntryInput {
  return {
    course: "UQ24CA221B",
    facultyId: "fac-1",
    geofenceId: "geo-1",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:00",
    ...partial,
  };
}

function entry(partial: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "s1",
    course: "UQ24CA221B",
    faculty_id: "fac-1",
    geofence_id: "geo-1",
    day_of_week: 1,
    start_time: "09:00:00",
    end_time: "10:00:00",
    ...partial,
  };
}

test("normaliseTime: pads and accepts HH:MM / HH:MM:SS", () => {
  assert.equal(normaliseTime("9:05"), "09:05:00");
  assert.equal(normaliseTime("09:05:30"), "09:05:30");
  assert.equal(normaliseTime("23:59"), "23:59:00");
});

test("normaliseTime: rejects invalid times", () => {
  assert.equal(normaliseTime("25:00"), null);
  assert.equal(normaliseTime("12:60"), null);
  assert.equal(normaliseTime("noon"), null);
  assert.equal(normaliseTime(""), null);
});

test("validateScheduleInput: accepts a valid entry", () => {
  assert.equal(validateScheduleInput(input()), null);
});

test("validateScheduleInput: rejects empty course", () => {
  assert.equal(validateScheduleInput(input({ course: "  " })), "Enter a course name.");
});

test("validateScheduleInput: rejects start_time >= end_time", () => {
  assert.equal(
    validateScheduleInput(input({ startTime: "10:00", endTime: "10:00" })),
    "Start time must be before end time."
  );
  assert.equal(
    validateScheduleInput(input({ startTime: "11:00", endTime: "10:00" })),
    "Start time must be before end time."
  );
});

test("validateScheduleInput: rejects day_of_week outside 0–6", () => {
  assert.match(
    validateScheduleInput(input({ dayOfWeek: -1 })) ?? "",
    /Day of week/
  );
  assert.match(
    validateScheduleInput(input({ dayOfWeek: 7 })) ?? "",
    /Day of week/
  );
  assert.match(
    validateScheduleInput(input({ dayOfWeek: 1.5 })) ?? "",
    /Day of week/
  );
});

test("validateScheduleInput: rejects missing faculty / geofence", () => {
  assert.equal(
    validateScheduleInput(input({ facultyId: "" })),
    "Choose a faculty member."
  );
  assert.equal(
    validateScheduleInput(input({ geofenceId: "" })),
    "Choose a classroom geofence."
  );
});

test("filterScheduleByDay: keeps only the requested day, sorted by start", () => {
  const rows = [
    entry({ id: "a", day_of_week: 1, start_time: "14:00:00" }),
    entry({ id: "b", day_of_week: 2, start_time: "09:00:00" }),
    entry({ id: "c", day_of_week: 1, start_time: "09:00:00" }),
  ];
  const mon = filterScheduleByDay(rows, 1);
  assert.deepEqual(
    mon.map((e) => e.id),
    ["c", "a"]
  );
  assert.equal(filterScheduleByDay(rows, 5).length, 0);
});

test("mapScheduleEntry: converts the API's camelCase schedule fields for the UI", () => {
  const mapped = mapScheduleEntry({
    id: "slot-1",
    course: "UQ24CA221B",
    facultyId: "fac-1",
    geofenceId: "geo-1",
    classId: "class-1",
    dayOfWeek: 1,
    startTime: "09:00:00",
    endTime: "10:00:00",
    faculty: { id: "fac-1", fullName: "Demo Faculty" },
    geofence: { roomName: "B-204" },
    class_: { id: "class-1", name: "CSE-A", branch: "CSE", semester: "4", section: "A" },
  });

  assert.equal(mapped.day_of_week, 1);
  assert.equal(mapped.start_time, "09:00:00");
  assert.equal(mapped.class_id, "class-1");
  assert.equal(mapped.profiles?.full_name, "Demo Faculty");
  assert.equal(mapped.geofences?.room_name, "B-204");
});

test("formatTimeRange: strips seconds for display", () => {
  assert.equal(formatTimeRange("09:00:00", "10:30:00"), "09:00 – 10:30");
});
