import { prisma } from "../config/db";
import { config } from "../config/env";
import { fetchAttendanceSummary } from "./attendance-summary";
import {
  ATTENDANCE_TARGET,
  MARKS_TARGET,
  buildClassInsight,
  buildStudentInsight,
  type ClassInsight,
  type ClassMetrics,
  type StudentInsight,
  type SubjectMetrics,
} from "./performance-feedback";

const pct = (score: unknown, max: unknown) => (100 * Number(score)) / Number(max);
const round = (v: number) => Math.round(v);

// Cached per student/course and keyed by a fingerprint of the numbers, so new attendance or
// marks always produce a fresh insight. Model output is kept for an hour; rule-based output
// (model down or slow) only briefly, so the AI is retried soon after it comes back.
const AI_TTL_MS = 60 * 60_000;
const FALLBACK_TTL_MS = 60_000;
type Entry<T> = { key: string; at: number; value: T };
const cache = new Map<string, Entry<{ source: string }>>();
const inflight = new Map<string, Promise<unknown>>();

async function cached<T extends { source: string }>(id: string, fingerprint: unknown, build: () => Promise<T>): Promise<T> {
  const key = JSON.stringify([fingerprint, config.ollama.enabled, config.ollama.model]);
  const hit = cache.get(id);
  if (hit && hit.key === key && Date.now() - hit.at < (hit.value.source === "qwen" ? AI_TTL_MS : FALLBACK_TTL_MS)) {
    return hit.value as T;
  }
  const flightKey = `${id}|${key}`;
  const pending = inflight.get(flightKey);
  if (pending) return pending as Promise<T>;
  const promise = build()
    .then((value) => {
      cache.set(id, { key, at: Date.now(), value });
      return value;
    })
    .finally(() => inflight.delete(flightKey));
  inflight.set(flightKey, promise);
  return promise;
}

/** Per-subject attendance and marks for one student, limited to `courses` when given. */
export async function studentSubjectMetrics(studentId: string, courses?: string[]): Promise<SubjectMetrics[]> {
  const [summary, marks] = await Promise.all([
    fetchAttendanceSummary({ studentId, ...(courses ? { courseCodes: courses } : {}) }),
    prisma.marks.findMany({
      where: { studentId, ...(courses ? { course: { in: courses } } : {}) },
      select: { course: true, assessment: true, score: true, maxScore: true, courseRow: { select: { name: true } } },
    }),
  ]);

  const subjects = new Map<string, SubjectMetrics>();
  for (const r of summary) {
    subjects.set(r.course_code, {
      course: r.course_code,
      courseName: r.course_name,
      attendancePct: r.official_pct === null ? null : round(r.official_pct),
      conducted: r.conducted,
      attended: r.present_cnt + r.late_cnt + r.partial_cnt,
      marksPct: null,
      assessments: [],
    });
  }
  for (const m of marks) {
    const s =
      subjects.get(m.course) ??
      subjects
        .set(m.course, { course: m.course, courseName: m.courseRow.name, attendancePct: null, conducted: 0, attended: 0, marksPct: null, assessments: [] })
        .get(m.course)!;
    s.assessments.push({ name: m.assessment, pct: round(pct(m.score, m.maxScore)) });
  }
  for (const s of subjects.values()) {
    s.assessments.sort((a, b) => a.pct - b.pct);
    if (s.assessments.length) s.marksPct = round(s.assessments.reduce((n, a) => n + a.pct, 0) / s.assessments.length);
  }
  return [...subjects.values()].sort((a, b) => a.course.localeCompare(b.course));
}

export async function studentInsight(studentId: string, courses?: string[]): Promise<StudentInsight> {
  const metrics = await studentSubjectMetrics(studentId, courses);
  return cached(`student:${studentId}:${courses?.join(",") ?? "*"}`, metrics, () => buildStudentInsight(metrics));
}

export async function classMetrics(course: string): Promise<ClassMetrics & { rows: ClassStudentRow[] }> {
  const [courseRow, enrolled, summary, marks, sessionsHeld] = await Promise.all([
    prisma.course.findUnique({ where: { code: course }, select: { name: true } }),
    prisma.enrollment.findMany({
      where: { courseCode: course, active: true },
      select: { student: { select: { id: true, fullName: true, rollNo: true } } },
    }),
    fetchAttendanceSummary({ courseCode: course }),
    prisma.marks.findMany({ where: { course }, select: { studentId: true, assessment: true, score: true, maxScore: true } }),
    prisma.session.count({ where: { course, closedAt: { not: null } } }),
  ]);

  const attBy = new Map(summary.map((r) => [r.student_id, r]));
  const marksBy = new Map<string, number[]>();
  const byAssessment = new Map<string, number[]>();
  for (const m of marks) {
    const p = pct(m.score, m.maxScore);
    marksBy.set(m.studentId, [...(marksBy.get(m.studentId) ?? []), p]);
    byAssessment.set(m.assessment, [...(byAssessment.get(m.assessment) ?? []), p]);
  }
  const avg = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  const rows: ClassStudentRow[] = enrolled
    .map(({ student }) => {
      const a = attBy.get(student.id);
      const attendancePct = a && a.official_pct !== null ? round(a.official_pct) : null;
      const marksPct = avg(marksBy.get(student.id) ?? []);
      return { studentId: student.id, name: student.fullName, usn: student.rollNo, attendancePct, marksPct };
    })
    .sort((x, y) => (x.attendancePct ?? 101) + (x.marksPct ?? 101) - ((y.attendancePct ?? 101) + (y.marksPct ?? 101)));

  const attVals = rows.map((r) => r.attendancePct).filter((v): v is number => v !== null);
  const markVals = rows.map((r) => r.marksPct).filter((v): v is number => v !== null);
  return {
    course,
    courseName: courseRow?.name ?? course,
    students: rows.length,
    sessionsHeld,
    attendancePct: avg(attVals),
    marksPct: avg(markVals),
    belowAttendance: attVals.filter((v) => v < ATTENDANCE_TARGET).length,
    belowMarks: markVals.filter((v) => v < MARKS_TARGET).length,
    assessments: [...byAssessment.entries()]
      .map(([name, xs]) => ({ name, pct: avg(xs)!, count: xs.length }))
      .sort((a, b) => a.pct - b.pct),
    rows,
  };
}

export interface ClassStudentRow {
  studentId: string;
  name: string;
  usn: string | null;
  attendancePct: number | null;
  marksPct: number | null;
}

export async function classInsight(course: string): Promise<{ metrics: ClassMetrics; rows: ClassStudentRow[]; insight: ClassInsight }> {
  const { rows, ...metrics } = await classMetrics(course);
  const insight = await cached(`class:${course}`, metrics, () => buildClassInsight(metrics));
  return { metrics, rows, insight };
}
