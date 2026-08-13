
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateClassInput, filterClasses, type ClassInput } from "./classes.ts";

function input(partial: Partial<ClassInput> = {}): ClassInput {
  return {
    name: "Sem-4 CSE-A",
    branch: "CSE",
    semester: "Sem-4",
    section: "A",
    academicYear: "2024-2025",
    ...partial,
  };
}

test("validateClassInput: accepts valid input", () => {
  const result = validateClassInput(input());
  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
});

test("validateClassInput: rejects empty name", () => {
  const result = validateClassInput(input({ name: " " }));
  assert.equal(result.isValid, false);
  assert.equal(result.errors.name, "Class name is required");
});

test("validateClassInput: rejects name too short or too long", () => {
  const shortResult = validateClassInput(input({ name: "A" }));
  assert.equal(shortResult.isValid, false);
  assert.equal(shortResult.errors.name, "Class name must be between 2 and 100 characters");

  const longResult = validateClassInput(input({ name: "X".repeat(101) }));
  assert.equal(longResult.isValid, false);
  assert.equal(longResult.errors.name, "Class name must be between 2 and 100 characters");
});

test("validateClassInput: rejects missing branch, semester, section, academicYear", () => {
  const result = validateClassInput({ name: "Valid Name" });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.branch);
  assert.ok(result.errors.semester);
  assert.ok(result.errors.section);
  assert.ok(result.errors.academicYear);
});

test("filterClasses: filters by search term, branch, and semester", () => {
  const list = [
    { name: "Sem-4 CSE-A", branch: "CSE", semester: "Sem-4" },
    { name: "Sem-4 CSE-B", branch: "CSE", semester: "Sem-4" },
    { name: "Sem-6 ECE-A", branch: "ECE", semester: "Sem-6" },
  ];

  assert.equal(filterClasses(list, "CSE").length, 2);
  assert.equal(filterClasses(list, "", "ECE").length, 1);
  assert.equal(filterClasses(list, "", "", "Sem-4").length, 2);
  assert.equal(filterClasses(list, "B").length, 1);
  assert.equal(filterClasses(list, "NonExistent").length, 0);
});
