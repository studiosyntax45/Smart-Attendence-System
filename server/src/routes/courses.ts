
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";

export const courseRouter = Router();

courseRouter.use(requireAuth);

courseRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const courses = await prisma.course.findMany({ orderBy: { code: "asc" } });
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
    const course = await prisma.course.upsert({
      where: { code: data.code },
      create: data,
      update: { name: data.name, credits: data.credits, semester: data.semester },
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
