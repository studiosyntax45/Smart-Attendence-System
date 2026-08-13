
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";

export const enrollmentRouter = Router();

enrollmentRouter.use(requireAuth);

enrollmentRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";
    const studentId = typeof req.query.studentId === "string" ? req.query.studentId : me.id;
    if (!isStaff && studentId !== me.id) throw forbidden();

    const rows = await prisma.enrollment.findMany({
      where: { studentId },
      include: { course: true },
      orderBy: { courseCode: "asc" },
    });
    res.json({ enrollments: rows });
  })
);
const setEnrollmentsSchema = z.object({
  courseCode: z.string().min(1),
  studentIds: z.array(z.string().uuid()),
});

enrollmentRouter.post(
  "/sync",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const data = setEnrollmentsSchema.parse(req.body);
    const existing = await prisma.enrollment.findMany({
      where: { courseCode: data.courseCode },
      select: { studentId: true, active: true },
    });
    const wanted = new Set(data.studentIds);
    const current = new Map(existing.map((e) => [e.studentId, e.active]));

    const toInsert = data.studentIds.filter((id) => !current.has(id));
    const toReactivate = data.studentIds.filter(
      (id) => current.has(id) && current.get(id) === false
    );
    const toDeactivate = [...current.keys()].filter(
      (id) => !wanted.has(id) && current.get(id) === true
    );

    if (toInsert.length > 0) {
      await prisma.enrollment.createMany({
        data: toInsert.map((studentId) => ({ studentId, courseCode: data.courseCode })),
      });
    }
    if (toReactivate.length > 0) {
      await prisma.enrollment.updateMany({
        where: { courseCode: data.courseCode, studentId: { in: toReactivate } },
        data: { active: true },
      });
    }
    if (toDeactivate.length > 0) {
      await prisma.enrollment.updateMany({
        where: { courseCode: data.courseCode, studentId: { in: toDeactivate } },
        data: { active: false },
      });
    }
    res.json({
      inserted: toInsert.length,
      reactivated: toReactivate.length,
      deactivated: toDeactivate.length,
    });
  })
);

enrollmentRouter.delete(
  "/:id",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.enrollment.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Enrollment not found.");
    await prisma.enrollment.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
