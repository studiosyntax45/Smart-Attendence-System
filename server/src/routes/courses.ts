
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { courseScope } from "../services/scope";
import { writeAudit } from "../services/audit";

export const courseRouter = Router();

courseRouter.use(requireAuth);

courseRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    // ?mine=true: a faculty member's own courses (attendance pages); everyone else gets all.
    const scope = req.query.mine === "true" ? await courseScope(req.user!) : null;
    const courses = await prisma.course.findMany({
      where: scope ? { code: { in: scope } } : undefined,
      orderBy: { code: "asc" },
    });
    res.json({ courses });
  })
);

const upsertCourseSchema = z.object({
  code: z.string().regex(/^[A-Z0-9-]{2,20}$/),
  name: z.string().min(1).max(120),
  credits: z.number().min(0).max(10),
  semester: z.string().min(1).max(40),
});

courseRouter.post(
  "/",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const data = upsertCourseSchema.parse(req.body);
    const me = req.user!;
    const existed = await prisma.course.findUnique({ where: { code: data.code } });
    const course = await prisma.course.upsert({
      where: { code: data.code },
      create: data,
      update: { name: data.name, credits: data.credits, semester: data.semester },
    });
    await writeAudit({ id: me.id, role: me.role }, existed ? "update_course" : "create_course", "course", {
      entityId: data.code,
      summary: `${existed ? "Updated" : "Created"} course ${data.code} (${data.name}).`,
      before: existed ? { name: existed.name, credits: Number(existed.credits), semester: existed.semester } : undefined,
      after: data,
    });
    res.json({ course });
  })
);

courseRouter.delete(
  "/:code",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await prisma.course.delete({ where: { code: req.params.code } });
    res.status(204).end();
  })
);
