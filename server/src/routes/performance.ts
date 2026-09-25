import { Router } from "express";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPerformanceFeedback } from "../services/performance-feedback";

export const performanceRouter = Router();

performanceRouter.use(requireAuth);

performanceRouter.get(
  "/me",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [sessionsHeld, attendance, marks] = await Promise.all([
      prisma.session.count({ where: { closedAt: { not: null }, openedAt: { gte: since } } }),
      prisma.attendance.findMany({
        where: { studentId: req.user!.id, entryTime: { gte: since }, excused: false },
        select: { status: true },
      }),
      prisma.marks.findMany({
        where: { studentId: req.user!.id },
        select: { course: true, score: true, maxScore: true },
      }),
    ]);

    const attended = attendance.filter((row) => row.status !== "absent").length;
    const attendancePct = sessionsHeld > 0 ? Math.round((100 * attended) / sessionsHeld) : null;
    const marksPct =
      marks.length > 0
        ? Math.round(
            marks.reduce((total, row) => total + (100 * Number(row.score)) / Number(row.maxScore), 0) /
              marks.length
          )
        : null;
    const byCourse = new Map<string, { total: number; count: number }>();
    for (const row of marks) {
      const current = byCourse.get(row.course) ?? { total: 0, count: 0 };
      current.total += (100 * Number(row.score)) / Number(row.maxScore);
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
