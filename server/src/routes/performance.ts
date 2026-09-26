import { Router } from "express";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeAttendanceHealth, HEALTH_THRESHOLDS } from "../services/attendance-health";
import { fetchAttendanceSummary } from "../services/attendance-summary";
import { getPerformanceFeedback } from "../services/performance-feedback";
import { courseScope } from "../services/scope";

export const performanceRouter = Router();

performanceRouter.use(requireAuth);

type MarkRow = { studentId?: string; course: string; score: unknown; maxScore: unknown };
const pctOf = (m: MarkRow) => (100 * Number(m.score)) / Number(m.maxScore);

performanceRouter.get(
  "/me",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const [summary, marks] = await Promise.all([
      fetchAttendanceSummary({ studentId: req.user!.id }),
      prisma.marks.findMany({
        where: { studentId: req.user!.id },
        select: { course: true, score: true, maxScore: true },
      }),
    ]);

    const sessionsHeld = summary.reduce((n, r) => n + r.conducted, 0);
    const attended = summary.reduce((n, r) => n + r.present_cnt + r.late_cnt + r.partial_cnt, 0);
    const attendancePct = sessionsHeld > 0 ? Math.round((100 * attended) / sessionsHeld) : null;
    const marksPct =
      marks.length > 0 ? Math.round(marks.reduce((total, row) => total + pctOf(row), 0) / marks.length) : null;
    const byCourse = new Map<string, { total: number; count: number }>();
    for (const row of marks) {
      const current = byCourse.get(row.course) ?? { total: 0, count: 0 };
      current.total += pctOf(row);
      current.count += 1;
      byCourse.set(row.course, current);
    }
    const subjects = [...byCourse.entries()]
      .map(([course, value]) => ({ course, marksPct: Math.round(value.total / value.count) }))
      .sort((a, b) => a.marksPct - b.marksPct);
    const feedback = await getPerformanceFeedback({ attendancePct, marksPct, subjects });

    res.json({
      metrics: { attendancePct, marksPct, sessionsHeld, attended, subjects },
      feedback,
    });
  })
);

/**
 * One row per student for the attendance-vs-marks analysis: attendance from the
 * same summary SQL as Attendance Health, marks averaged over every assessment,
 * both limited to the faculty member's own courses.
 */
performanceRouter.get(
  "/cohort",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const scope = await courseScope(req.user!);
    const [health, marks, classesHeld] = await Promise.all([
      computeAttendanceHealth(HEALTH_THRESHOLDS, scope ?? undefined),
      prisma.marks.findMany({
        where: scope ? { course: { in: scope } } : undefined,
        select: { studentId: true, course: true, score: true, maxScore: true },
      }),
      prisma.session.count({
        where: { closedAt: { not: null }, ...(scope ? { course: { in: scope } } : {}) },
      }),
    ]);

    const marksBy = new Map<string, { total: number; n: number }>();
    for (const m of marks) {
      const agg = marksBy.get(m.studentId) ?? { total: 0, n: 0 };
      agg.total += pctOf(m);
      agg.n += 1;
      marksBy.set(m.studentId, agg);
    }

    const students = health.students
      .filter((s) => s.conducted > 0 && marksBy.has(s.studentId))
      .map((s) => {
        const m = marksBy.get(s.studentId)!;
        return {
          studentId: s.studentId,
          name: s.fullName,
          usn: s.rollNo,
          section: s.section,
          attended: s.attended,
          conducted: s.conducted,
          attendancePct: s.pct,
          marksPct: Math.round(m.total / m.n),
          assessments: m.n,
          band: s.status,
        };
      });

    res.json({ thresholds: health.thresholds, classesHeld, students });
  })
);
