
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";

export const classRouter = Router();

classRouter.use(requireAuth);

classRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { students: true, courses: true } },
      },
    });
    res.json({
      classes: classes.map((c) => ({
        ...c,
        student_count: c._count.students,
        course_count: c._count.courses,
      })),
    });
  })
);

classRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const cls = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: { students: { include: { student: true } }, courses: { include: { course: true } } },
    });
    if (!cls) throw notFound("Class not found.");
    res.json({ class: cls });
  })
);

const createClassSchema = z.object({
  name: z.string().min(2).max(100),
  branch: z.string().min(1),
  semester: z.string().min(1),
  section: z.string().min(1),
  academicYear: z.string().min(1),
});

classRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const data = createClassSchema.parse(req.body);
    try {
      const cls = await prisma.class.create({ data });
      res.status(201).json({ class: cls });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        throw badRequest(
          `Class section '${data.branch} ${data.semester}-${data.section}' already exists.`
        );
      }
      throw err;
    }
  })
);

classRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await prisma.class.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

const patchClassSchema = z.object({
  name:         z.string().min(2).max(100).optional(),
  branch:       z.string().min(1).optional(),
  semester:     z.string().min(1).optional(),
  section:      z.string().min(1).optional(),
  academicYear: z.string().min(1).optional(),
});

classRouter.patch(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const data = patchClassSchema.parse(req.body);
    if (Object.keys(data).length === 0) {
      throw badRequest("No fields provided to update.");
    }
    try {
      const cls = await prisma.class.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ class: cls });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2025") throw notFound("Class not found.");
      if (code === "P2002")
        throw badRequest("A class with that branch/semester/section/year combination already exists.");
      throw err;
    }
  })
);

classRouter.get(
  "/:id/students",
  asyncHandler(async (req, res) => {
    const rows = await prisma.classStudent.findMany({
      where: { classId: req.params.id },
      include: { student: { select: { id: true, fullName: true, rollNo: true } } },
      orderBy: { enrolledAt: "asc" },
    });
    res.json({
      students: rows.map((r) => ({
        student_id: r.student.id,
        full_name: r.student.fullName,
        roll_no: r.student.rollNo,
        enrolled_at: r.enrolledAt,
      })),
    });
  })
);

const assignStudentsSchema = z.object({
  studentIds: z.array(z.string().uuid()),
});

classRouter.post(
  "/:id/students",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const { studentIds } = assignStudentsSchema.parse(req.body);
    if (studentIds.length === 0) throw badRequest("No students selected.");

    const cls = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!cls) throw notFound("Class not found.");
    await prisma.classStudent.createMany({
      data: studentIds.map((studentId) => ({ classId: req.params.id!, studentId })),
      skipDuplicates: true,
    });
    for (const studentId of studentIds) {
      await prisma.studentDetails.upsert({
        where: { studentId },
        create: { studentId, branch: cls.branch, section: cls.section, updatedAt: new Date() },
        update: { branch: cls.branch, section: cls.section, updatedAt: new Date() },
      });
    }
    const classCourses = await prisma.classCourse.findMany({
      where: { classId: req.params.id },
      select: { courseCode: true },
    });
    if (classCourses.length > 0) {
      await prisma.enrollment.createMany({
        data: studentIds.flatMap((studentId) =>
          classCourses.map((cc) => ({ studentId, courseCode: cc.courseCode }))
        ),
        skipDuplicates: true,
      });
    }

    res.json({ message: `Assigned ${studentIds.length} student(s).` });
  })
);

classRouter.delete(
  "/:id/students/:studentId",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    await prisma.classStudent.delete({
      where: { classId_studentId: { classId: req.params.id, studentId: req.params.studentId } },
    });
    res.status(204).end();
  })
);

classRouter.post(
  "/:id/courses",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const { courseCode } = z.object({ courseCode: z.string().min(1) }).parse(req.body);
    try {
      await prisma.classCourse.create({
        data: { classId: req.params.id!, courseCode },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") throw badRequest("Course is already assigned to this class.");
      throw err;
    }
    const students = await prisma.classStudent.findMany({
      where: { classId: req.params.id },
      select: { studentId: true },
    });
    if (students.length > 0) {
      await prisma.enrollment.createMany({
        data: students.map((s) => ({ studentId: s.studentId, courseCode })),
        skipDuplicates: true,
      });
    }
    res.status(201).json({ message: `Course '${courseCode}' linked.` });
  })
);

classRouter.delete(
  "/:id/courses/:courseCode",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    await prisma.classCourse.delete({
      where: { classId_courseCode: { classId: req.params.id, courseCode: req.params.courseCode } },
    });
    res.status(204).end();
  })
);
