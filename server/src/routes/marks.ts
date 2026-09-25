
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, forbidden } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../services/audit";
import { normaliseUsn } from "../services/bulk";

export const marksRouter = Router();

marksRouter.use(requireAuth);
marksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";
    const queryStudentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
    const course = typeof req.query.course === "string" ? req.query.course : undefined;

    if (!isStaff && queryStudentId && queryStudentId !== me.id) throw forbidden();
    // Staff see everyone unless a studentId is given; students only themselves.
    const studentId = isStaff ? queryStudentId : me.id;

    const rows = await prisma.marks.findMany({
      where: { ...(studentId ? { studentId } : {}), ...(course ? { course } : {}) },
      orderBy: studentId
        ? [{ course: "asc" }, { assessment: "asc" }]
        : [{ updatedAt: "desc" }],
      take: studentId ? undefined : 200,
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
    await writeAudit({ id: me.id, role: me.role }, "update_marks", "marks", {
      entityId: row.id,
      summary: `Saved ${data.course} ${data.assessment}: ${data.score}/${data.maxScore}.`,
      after: { course: data.course, assessment: data.assessment, score: data.score, maxScore: data.maxScore },
    });
    res.json({ mark: row });
  })
);
const bulkSchema = z.object({
  course: z.string().min(1),
  assessment: z.string().min(1),
  maxScore: z.number().positive(),
  rows: z
    .array(z.object({ usn: z.string().min(1), score: z.number() }))
    .min(1, "The file had no usable rows.")
    .max(500, "Upload at most 500 rows at a time."),
});

marksRouter.post(
  "/bulk",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const data = bulkSchema.parse(req.body);

    const course = await prisma.course.findUnique({ where: { code: data.course } });
    if (!course) throw badRequest(`Course "${data.course}" does not exist — create it on the Courses page first.`);

    const students = await prisma.profile.findMany({
      where: { role: "student", rollNo: { not: null } },
      select: { id: true, rollNo: true },
    });
    const byUsn = new Map(students.map((s) => [normaliseUsn(s.rollNo!), s.id]));

    const skipped: Array<{ usn: string; reason: string }> = [];
    const writes: Array<{ studentId: string; score: number }> = [];
    const seen = new Set<string>();

    for (const row of data.rows) {
      const key = normaliseUsn(row.usn);
      const studentId = byUsn.get(key);
      if (!studentId) {
        skipped.push({ usn: row.usn, reason: "No student with that USN." });
      } else if (seen.has(key)) {
        skipped.push({ usn: row.usn, reason: "Duplicate USN in the file." });
      } else if (!Number.isFinite(row.score) || row.score < 0 || row.score > data.maxScore) {
        skipped.push({ usn: row.usn, reason: `Score must be between 0 and ${data.maxScore}.` });
      } else {
        seen.add(key);
        writes.push({ studentId, score: row.score });
      }
    }

    if (writes.length === 0) throw badRequest("No rows could be saved — every row was rejected.");

    await prisma.$transaction(
      writes.map((w) =>
        prisma.marks.upsert({
          where: {
            studentId_course_assessment: {
              studentId: w.studentId,
              course: data.course,
              assessment: data.assessment,
            },
          },
          create: {
            studentId: w.studentId,
            course: data.course,
            assessment: data.assessment,
            score: w.score,
            maxScore: data.maxScore,
            updatedBy: me.id,
          },
          update: {
            score: w.score,
            maxScore: data.maxScore,
            updatedBy: me.id,
            updatedAt: new Date(),
          },
        })
      )
    );

    await writeAudit({ id: me.id, role: me.role }, "import_marks", "marks", {
      summary: `Bulk marks for ${data.course} ${data.assessment}: ${writes.length} saved, ${skipped.length} skipped.`,
      after: { course: data.course, assessment: data.assessment, saved: writes.length, skipped: skipped.length },
    });
    res.json({ saved: writes.length, skipped });
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
