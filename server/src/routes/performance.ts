import { Router } from "express";
import { prisma } from "../config/db";
import { asyncHandler, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeAttendanceHealth, HEALTH_THRESHOLDS } from "../services/attendance-health";
import { classInsight, studentInsight } from "../services/insights";
import { courseScope } from "../services/scope";

export const performanceRouter = Router();

performanceRouter.use(requireAuth);

type MarkRow = { studentId?: string; course: string; score: unknown; maxScore: unknown };
const pctOf = (m: MarkRow) => (100 * Number(m.score)) / Number(m.maxScore);

performanceRouter.get(
  "/insights/me",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    res.json({ insight: await studentInsight(req.user!.id) });
  })
);

performanceRouter.get(
  "/insights/courses",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const scope = await courseScope(req.user!);
    const courses = await prisma.course.findMany({
      where: scope ? { code: { in: scope } } : undefined,
      orderBy: [{ semester: "desc" }, { code: "asc" }],
      select: { code: true, name: true, semester: true, _count: { select: { enrollments: { where: { active: true } } } } },
    });
    res.json({
      courses: courses.map((c) => ({ code: c.code, name: c.name, semester: c.semester, students: c._count.enrollments })),
    });
  })
);

performanceRouter.get(
  "/insights/course/:code",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const scope = await courseScope(req.user!);
    if (scope && !scope.includes(req.params.code)) throw forbidden("You can only view insights for courses you teach.");
    res.json(await classInsight(req.params.code));
  })
);

/** Faculty see only the subjects they teach; admins see every subject. */
performanceRouter.get(
  "/insights/student/:id",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const scope = await courseScope(req.user!);
    const student = await prisma.profile.findUnique({ where: { id: req.params.id }, select: { role: true, fullName: true, rollNo: true } });
    if (!student || student.role !== "student") throw notFound("Student not found.");
    if (scope) {
      const shared = await prisma.enrollment.count({ where: { studentId: req.params.id, courseCode: { in: scope } } });
      if (shared === 0) throw forbidden("This student is not in any of your courses.");
    }
    res.json({ student: { id: req.params.id, name: student.fullName, usn: student.rollNo }, insight: await studentInsight(req.params.id, scope ?? undefined) });
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
