
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";

export const marksRouter = Router();

marksRouter.use(requireAuth);
marksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";
    const studentId = typeof req.query.studentId === "string" ? req.query.studentId : me.id;
    const course = typeof req.query.course === "string" ? req.query.course : undefined;

    if (!isStaff && studentId !== me.id) throw forbidden();

    const rows = await prisma.marks.findMany({
      where: { studentId, ...(course ? { course } : {}) },
      orderBy: [{ course: "asc" }, { assessment: "asc" }],
    });
    res.json({ marks: rows });
  })
);

const upsertMarkSchema = z.object({
  studentId: z.string().uuid(),
  course: z.string().min(1),
  assessment: z.string().min(1),
  score: z.number().min(0),
  maxScore: z.number().positive(),
});
marksRouter.post(
  "/",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const data = upsertMarkSchema.parse(req.body);
    if (data.score > data.maxScore) {
      throw badRequest(`Score must be between 0 and ${data.maxScore}.`);
    }

    if (me.role === "faculty") {
      const teaches = await prisma.classSchedule.findFirst({
        where: { facultyId: me.id, course: data.course },
      });
      if (!teaches) {
        throw forbidden(
          `You are not assigned to teach '${data.course}'. Only the course's scheduled faculty can enter marks.`
        );
      }
    }

    const row = await prisma.marks.upsert({
      where: {
        studentId_course_assessment: {
          studentId: data.studentId,
          course: data.course,
          assessment: data.assessment,
        },
      },
      create: {
        studentId: data.studentId,
        course: data.course,
        assessment: data.assessment,
        score: data.score,
        maxScore: data.maxScore,
        updatedBy: me.id,
      },
      update: {
        score: data.score,
        maxScore: data.maxScore,
        updatedBy: me.id,
        updatedAt: new Date(),
      },
    });
    res.json({ mark: row });
  })
);
marksRouter.delete(
  "/:id",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    await prisma.marks.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
