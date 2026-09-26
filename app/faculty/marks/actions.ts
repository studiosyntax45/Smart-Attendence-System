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
    return { message: `Saved ${assessment} for the student — ${score}/${maxScore}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save mark." };
  }
}

export interface BulkMarksResult {
  error?: string;
  saved?: number;
  skipped?: Array<{ usn: string; reason: string }>;
}

export async function bulkUploadMarks(input: {
  course: string;
  assessment: string;
  maxScore: number;
  rows: Array<{ usn: string; score: number }>;
}): Promise<BulkMarksResult> {
  if (!input.course) return { error: "Choose a course." };
  if (!input.assessment.trim()) return { error: "Enter an assessment name (e.g. ISA-1)." };
  if (input.rows.length === 0) return { error: "No valid rows to upload." };
  try {
    const res = await api.post<{ saved: number; skipped: Array<{ usn: string; reason: string }> }>(
      "/marks/bulk",
      { ...input, assessment: input.assessment.trim() }
    );
    return { saved: res.saved, skipped: res.skipped };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bulk upload failed." };
  }
}
