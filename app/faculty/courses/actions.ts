"use client";

import { api } from "@/lib/api-client";

export interface CourseActionState {
  error?: string;
  message?: string;
}


export async function upsertCourse(
  _prev: CourseActionState,
  formData: FormData
): Promise<CourseActionState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const credits = Number(formData.get("credits"));
  const semester = String(formData.get("semester") ?? "").trim();

  if (!/^[A-Z0-9-]{2,20}$/.test(code)) {
    return { error: "Course code: 2â€“20 letters, digits or dashes (e.g. UQ24CA221B)." };
  }
  if (!name) return { error: "Enter the course name." };
  if (!Number.isFinite(credits) || credits < 0 || credits > 10) {
    return { error: "Credits must be between 0 and 10." };
  }
  if (!semester) return { error: "Enter the semester (e.g. Sem-4)." };

  try {
    await api.post("/courses", { code, name, credits, semester });
    return { message: `Saved ${code} â€” ${name} (${credits} cr, ${semester}).` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save course." };
  }
}


export async function setEnrollments(
  courseCode: string,
  studentIds: string[]
): Promise<CourseActionState> {
  try {
    await api.post("/enrollments/sync", { courseCode, studentIds });
    return {
      message: `Roster saved â€” ${studentIds.length} student${studentIds.length === 1 ? "" : "s"} enrolled in ${courseCode}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update roster." };
  }
}
