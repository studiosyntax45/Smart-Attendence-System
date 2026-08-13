"use client";

import { api } from "@/lib/api-client";

export interface MarkFormState {
  error?: string;
  message?: string;
}


export async function upsertMark(
  _prev: MarkFormState,
  formData: FormData
): Promise<MarkFormState> {
  const studentId = String(formData.get("studentId") ?? "");
  const course = String(formData.get("course") ?? "").trim();
  const assessment = String(formData.get("assessment") ?? "").trim();
  const score = Number(formData.get("score"));
  const maxScore = Number(formData.get("maxScore"));

  if (!studentId) return { error: "Choose a student." };
  if (!course) return { error: "Enter a course." };
  if (!assessment) return { error: "Enter an assessment name (e.g. ISA-1)." };
  if (!Number.isFinite(maxScore) || maxScore <= 0)
    return { error: "Max score must be greater than 0." };
  if (!Number.isFinite(score) || score < 0 || score > maxScore)
    return { error: `Score must be between 0 and ${maxScore}.` };

  try {
    await api.post("/marks", { studentId, course, assessment, score, maxScore });
    return { message: `Saved ${assessment} for the student â€” ${score}/${maxScore}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save mark." };
  }
}
