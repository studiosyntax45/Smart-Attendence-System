import { api } from "./api-client";

export const ATTENDANCE_TARGET = 75;
export const MARKS_TARGET = 70;

export type InsightSource = "qwen" | "fallback";
export type SubjectStatus = "on_track" | "attendance" | "marks" | "at_risk" | "no_data";

export interface SubjectInsight {
  course: string;
  courseName: string;
  attendancePct: number | null;
  conducted: number;
  attended: number;
  marksPct: number | null;
  assessments: Array<{ name: string; pct: number }>;
  status: SubjectStatus;
  classesToTarget: number;
  insight: string;
  action: string;
}

export interface StudentInsight {
  source: InsightSource;
  attendancePct: number | null;
  marksPct: number | null;
  overall: { priority: string; summary: string; strengths: string[]; concerns: string[]; actions: string[] };
  subjects: SubjectInsight[];
}

export interface ClassInsightResponse {
  metrics: {
    course: string;
    courseName: string;
    students: number;
    sessionsHeld: number;
    attendancePct: number | null;
    marksPct: number | null;
    belowAttendance: number;
    belowMarks: number;
    assessments: Array<{ name: string; pct: number; count: number }>;
  };
  rows: Array<{ studentId: string; name: string; usn: string | null; attendancePct: number | null; marksPct: number | null }>;
  insight: { source: InsightSource; summary: string; focusAreas: string[]; actions: string[] };
}

export interface InsightCourse {
  code: string;
  name: string;
  semester: string;
  students: number;
}

export const STATUS_LABEL: Record<SubjectStatus, string> = {
  on_track: "On track",
  attendance: "Attendance low",
  marks: "Marks low",
  at_risk: "At risk",
  no_data: "No data yet",
};

export const STATUS_VARIANT: Record<SubjectStatus, "present" | "late" | "absent" | "outline"> = {
  on_track: "present",
  attendance: "late",
  marks: "late",
  at_risk: "absent",
  no_data: "outline",
};

export function sourceNote(source: InsightSource): string {
  return source === "qwen"
    ? "AI-generated guidance from the local model. Verify with your faculty."
    : "Rule-based guidance: the local AI model is off or unavailable.";
}

export const getMyInsight = () => api.get<{ insight: StudentInsight }>("/performance/insights/me").then((r) => r.insight);
export const getStudentInsight = (id: string) =>
  api.get<{ student: { id: string; name: string; usn: string | null }; insight: StudentInsight }>(`/performance/insights/student/${id}`);
export const listInsightCourses = () => api.get<{ courses: InsightCourse[] }>("/performance/insights/courses").then((r) => r.courses);
export const getClassInsight = (code: string) => api.get<ClassInsightResponse>(`/performance/insights/course/${encodeURIComponent(code)}`);
