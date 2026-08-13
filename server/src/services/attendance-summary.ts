import { prisma } from "../config/db";

export interface AttendanceSummaryRow {
  student_id: string;
  course_code: string;
  course_name: string;
  credits: number;
  semester: string;
  conducted: number;
  present_cnt: number;
  late_cnt: number;
  partial_cnt: number;
  absent_cnt: number;
  official_pct: number | null;
  weighted_pct: number | null;
}

export async function fetchAttendanceSummary(opts: {
  studentId?: string;
  studentIds?: string[];
  courseCode?: string;
} = {}): Promise<AttendanceSummaryRow[]> {
  const ids = opts.studentIds ?? (opts.studentId ? [opts.studentId] : undefined);

  const rows = await prisma.$queryRaw<
    Array<{
      student_id: string;
      course_code: string;
      course_name: string;
      credits: string | number;
      semester: string;
      conducted: number | bigint;
      present_cnt: number | bigint;
      late_cnt: number | bigint;
      partial_cnt: number | bigint;
      absent_cnt: number | bigint;
      official_pct: number | null;
      weighted_pct: number | null;
    }>
  >`
    SELECT
      e.student_id                                AS student_id,
      e.course_code                               AS course_code,
      c.name                                      AS course_name,
      c.credits                                   AS credits,
      c.semester                                  AS semester,
      COUNT(CASE WHEN COALESCE(a.excused, 0) = 0 THEN s.id ELSE NULL END) AS conducted,
      COUNT(CASE WHEN a.status = 'present' AND COALESCE(a.excused, 0) = 0 THEN a.id ELSE NULL END) AS present_cnt,
      COUNT(CASE WHEN a.status = 'late'    AND COALESCE(a.excused, 0) = 0 THEN a.id ELSE NULL END) AS late_cnt,
      COUNT(CASE WHEN a.status = 'partial' AND COALESCE(a.excused, 0) = 0 THEN a.id ELSE NULL END) AS partial_cnt,
      (COUNT(CASE WHEN COALESCE(a.excused, 0) = 0 THEN s.id ELSE NULL END)
        - COUNT(CASE WHEN a.status IN ('present','late','partial') AND COALESCE(a.excused, 0) = 0 THEN a.id ELSE NULL END)
      ) AS absent_cnt,
      CASE
        WHEN COUNT(CASE WHEN COALESCE(a.excused, 0) = 0 THEN s.id ELSE NULL END) = 0 THEN NULL
        ELSE ROUND(
          100.0 * COUNT(CASE WHEN a.status IN ('present','late','partial') AND COALESCE(a.excused, 0) = 0 THEN a.id ELSE NULL END)
                / COUNT(CASE WHEN COALESCE(a.excused, 0) = 0 THEN s.id ELSE NULL END), 2)
      END AS official_pct,
      CASE
        WHEN COUNT(CASE WHEN COALESCE(a.excused, 0) = 0 THEN s.id ELSE NULL END) = 0 THEN NULL
        ELSE ROUND(
          100.0 * (
            COUNT(CASE WHEN a.status = 'present' AND COALESCE(a.excused, 0) = 0 THEN a.id ELSE NULL END)
            + 0.5 * COUNT(CASE WHEN a.status = 'late'    AND COALESCE(a.excused, 0) = 0 THEN a.id ELSE NULL END)
            + 0.5 * COUNT(CASE WHEN a.status = 'partial' AND COALESCE(a.excused, 0) = 0 THEN a.id ELSE NULL END)
          ) / COUNT(CASE WHEN COALESCE(a.excused, 0) = 0 THEN s.id ELSE NULL END), 2)
      END AS weighted_pct
    FROM enrollments e
    JOIN courses c ON c.code = e.course_code
    LEFT JOIN sessions s
      ON s.course = e.course_code
     AND s.closed_at IS NOT NULL
     AND s.opened_at >= e.enrolled_at
    LEFT JOIN attendance a
      ON a.session_id = s.id
     AND a.student_id = e.student_id
    WHERE e.active = 1
      ${ids ? prismaSafeIn("e.student_id", ids) : prismaEmpty()}
      ${opts.courseCode ? prismaSafeEq("e.course_code", opts.courseCode) : prismaEmpty()}
    GROUP BY e.student_id, e.course_code, c.name, c.credits, c.semester
    ORDER BY e.course_code
  `;

  return rows.map((r) => ({
    student_id: r.student_id,
    course_code: r.course_code,
    course_name: r.course_name,
    credits: typeof r.credits === "string" ? Number(r.credits) : r.credits,
    semester: r.semester,
    conducted: Number(r.conducted),
    present_cnt: Number(r.present_cnt),
    late_cnt: Number(r.late_cnt),
    partial_cnt: Number(r.partial_cnt),
    absent_cnt: Number(r.absent_cnt),
    official_pct: r.official_pct === null ? null : Number(r.official_pct),
    weighted_pct: r.weighted_pct === null ? null : Number(r.weighted_pct),
  }));
}

import { Prisma } from "@prisma/client";

function prismaSafeIn(column: string, values: string[]) {
  if (values.length === 0) return Prisma.sql``;
  return Prisma.sql`AND ${Prisma.raw(column)} IN (${Prisma.join(values)})`;
}
function prismaSafeEq(column: string, value: string) {
  return Prisma.sql`AND ${Prisma.raw(column)} = ${value}`;
}
function prismaEmpty() {
  return Prisma.sql``;
}
