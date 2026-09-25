import { fetchAttendanceSummary } from "./attendance-summary";
import { prisma } from "../config/db";

/** Source of truth; the client copies these for colours. */
export const HEALTH_THRESHOLDS = { good: 75, warning: 65 };

export type HealthStatus = "good" | "warning" | "critical";

export function healthStatus(pct: number, t = HEALTH_THRESHOLDS): HealthStatus {
  if (pct >= t.good) return "good";
  if (pct >= t.warning) return "warning";
  return "critical";
}

export interface StudentHealthRow {
  studentId: string;
  fullName: string;
  rollNo: string | null;
  branch: string | null;
  section: string | null;
  conducted: number;
  attended: number;
  pct: number;
  /** "none" = no closed sessions yet, so no percentage to judge. */
  status: HealthStatus | "none";
}

export interface CourseHealthRow extends Omit<StudentHealthRow, "status"> {
  courseCode: string;
  courseName: string;
  status: HealthStatus;
}

export interface AttendanceHealth {
  thresholds: typeof HEALTH_THRESHOLDS;
  courseRows: CourseHealthRow[];
  totals: { present: number; late: number; partial: number; absent: number; excused: number; conducted: number };
  buckets: { good: number; warning: number; critical: number };
  students: StudentHealthRow[];
}

/** One overall % per student, from the same SQL as the student summary. */
export async function computeAttendanceHealth(
  t = HEALTH_THRESHOLDS,
  courseCodes?: string[]
): Promise<AttendanceHealth> {
  const [summary, students, excusedCount] = await Promise.all([
    fetchAttendanceSummary({ courseCodes }),
    prisma.profile.findMany({
      where: { role: "student" },
      select: { id: true, fullName: true, rollNo: true, studentDetails: { select: { branch: true, section: true } } },
    }),
    prisma.attendance.count({ where: { excused: true } }),
  ]);

  const perStudent = new Map<string, { conducted: number; attended: number }>();
  const byId = new Map(students.map((s) => [s.id, s]));
  const courseRows: CourseHealthRow[] = [];
  const totals = { present: 0, late: 0, partial: 0, absent: 0, excused: excusedCount, conducted: 0 };

  for (const r of summary) {
    totals.present += r.present_cnt;
    totals.late += r.late_cnt;
    totals.partial += r.partial_cnt;
    totals.absent += r.absent_cnt;
    totals.conducted += r.conducted;
    const acc = perStudent.get(r.student_id) ?? { conducted: 0, attended: 0 };
    acc.conducted += r.conducted;
    acc.attended += r.present_cnt + r.late_cnt + r.partial_cnt;
    perStudent.set(r.student_id, acc);

    const s = byId.get(r.student_id);
    if (s && r.conducted > 0) {
      const attended = r.present_cnt + r.late_cnt + r.partial_cnt;
      const pct = r.official_pct ?? Math.round((100 * attended) / r.conducted);
      courseRows.push({
        studentId: s.id,
        fullName: s.fullName,
        rollNo: s.rollNo,
        branch: s.studentDetails?.branch ?? null,
        section: s.studentDetails?.section ?? null,
        courseCode: r.course_code,
        courseName: r.course_name,
        conducted: r.conducted,
        attended,
        pct: Math.round(pct),
        status: healthStatus(pct, t),
      });
    }
  }

  const buckets = { good: 0, warning: 0, critical: 0 };
  const rows: StudentHealthRow[] = students
    .map((s) => {
      const acc = perStudent.get(s.id) ?? { conducted: 0, attended: 0 };
      const pct = acc.conducted === 0 ? 0 : Math.round((100 * acc.attended) / acc.conducted);
      const status = acc.conducted === 0 ? ("none" as const) : healthStatus(pct, t);
      if (status !== "none") buckets[status] += 1;
      return {
        studentId: s.id,
        fullName: s.fullName,
        rollNo: s.rollNo,
        branch: s.studentDetails?.branch ?? null,
        section: s.studentDetails?.section ?? null,
        conducted: acc.conducted,
        attended: acc.attended,
        pct,
        status,
      };
    })
    .sort((a, b) => a.pct - b.pct);

  courseRows.sort((a, b) => a.pct - b.pct);
  return { thresholds: t, totals, buckets, students: rows, courseRows };
}
